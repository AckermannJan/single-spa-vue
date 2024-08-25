import type { Component, ComponentOptions, h as H } from "vue-demi";
import type {
  SingleSpaVueOpts,
  SingleSpaOptsVue2,
  SingleSpaOptsVue3,
  AppOptions,
  AppOptionsObject,
  AppOptionsFunction,
  Instance,
  InstanceVue2,
  InstanceVue3,
  VueLifecycles,
} from "@/types";
import type { AppProps, ParcelProps } from "single-spa";

export default function singleSpaVue<ExtraProps>(
  opts: SingleSpaVueOpts,
): VueLifecycles<ExtraProps> {
  const isVue2 = (opts: SingleSpaVueOpts): opts is SingleSpaOptsVue2 => {
    return (opts as SingleSpaOptsVue2).Vue !== undefined;
  };

  const isVue3 = (opts: SingleSpaVueOpts): opts is SingleSpaOptsVue3 => {
    return (opts as SingleSpaOptsVue3).createApp !== undefined;
  };

  const isAppOptionsObject = (opts: AppOptions): opts is AppOptionsObject => {
    return (opts as AppOptionsObject).el !== undefined;
  };

  if (typeof opts !== "object") {
    throw new Error(`single-spa-vue requires a configuration object`);
  }

  if (!isVue2(opts) && !isVue3(opts)) {
    throw Error("single-spa-vue must be passed opts.Vue or opts.createApp");
  }

  if (
    isAppOptionsObject(opts.appOptions) &&
    opts.appOptions.el &&
    typeof opts.appOptions.el !== "string" &&
    !(opts.appOptions.el instanceof HTMLElement)
  ) {
    throw Error(
      `single-spa-vue: appOptions.el must be a string CSS selector, an HTMLElement, or not provided at all. Was given ${typeof opts.appOptions.el}`,
    );
  }

  // @ts-expect-error - If the user has provided createApp via the Vue option, we are moving it to the correct createApp option
  opts.createApp =
    // @ts-expect-error - If the user has provided createApp via the Vue option, we are moving it to the correct createApp option
    opts.createApp || (opts.Vue && opts.Vue.createApp);

  const resolveAppOptions = async (
    opts: SingleSpaVueOpts,
    props: ExtraProps & AppProps,
  ): Promise<AppOptionsObject> => {
    if (typeof opts.appOptions === "function") {
      return (opts.appOptions as AppOptionsFunction)(opts, props);
    } else {
      return Promise.resolve({ ...opts.appOptions });
    }
  };

  const mount = async (
    opts: SingleSpaVueOpts,
    mountedInstances: Record<string, Instance>,
    props: ExtraProps & AppProps & ParcelProps,
  ) => {
    await Promise.resolve();
    const instance: Instance = {};
    const appOptions = await resolveAppOptions(opts, props);
    if (props.domElement && !appOptions.el) {
      appOptions.el = props.domElement;
    }

    let domEl: HTMLElement | null;
    if (appOptions.el) {
      if (typeof appOptions.el === "string") {
        domEl = document.querySelector(appOptions.el);
        if (!domEl) {
          throw Error(
            `If appOptions.el is provided to single-spa-vue, the dom element must exist in the dom. Was provided as ${appOptions.el}`,
          );
        }
      } else {
        domEl = appOptions.el;
        if (!domEl.id) {
          domEl.id = `single-spa-application:${props.name}`;
        }
        appOptions.el = `#${CSS.escape(domEl.id)}`;
      }
    } else {
      const htmlId = `single-spa-application:${props.name}`;
      appOptions.el = `#${CSS.escape(htmlId)}`;
      domEl = document.getElementById(htmlId);
      if (!domEl) {
        domEl = document.createElement("div");
        domEl.id = htmlId;
        document.body.appendChild(domEl);
      }
    }

    if (!opts.replaceMode) {
      appOptions.el = appOptions.el + " .single-spa-container";

      // single-spa-vue@>=2 always REPLACES the `el` instead of appending to it.
      // We want domEl to stick around and not be replaced. So we tell Vue to mount
      // into a container div inside the main domEl
      if (!domEl.querySelector(".single-spa-container")) {
        const singleSpaContainer = document.createElement("div");
        singleSpaContainer.className = "single-spa-container";
        domEl.appendChild(singleSpaContainer);
      }
    }

    (instance as Instance).domEl = domEl;

    if (!appOptions.render && !appOptions.template && opts.rootComponent) {
      appOptions.render = (h: typeof H) => h(opts.rootComponent as Component);
    }

    if (!appOptions.data) {
      appOptions.data = () => ({});
    }
    const originData = appOptions.data;
    appOptions.data = function () {
      const data =
        typeof originData === "function"
          ? originData.call(this, this)
          : originData;
      return { ...data, ...props };
    };

    if (isVue3(opts)) {
      const currentInstance = instance as InstanceVue3;
      currentInstance.vueInstance = opts.createApp(
        appOptions as unknown as ComponentOptions<any>,
      );
      if (opts.handleInstance) {
        await opts.handleInstance(currentInstance.vueInstance, props);
        currentInstance.root = currentInstance.vueInstance?.mount(
          appOptions.el,
        );
        mountedInstances[props.name] = currentInstance;
        return currentInstance.vueInstance;
      } else {
        currentInstance.root = currentInstance.vueInstance.mount(appOptions.el);
        mountedInstances[props.name] = instance;
        return currentInstance.vueInstance;
      }
    } else {
      const currentInstance = instance as InstanceVue2;
      currentInstance.vueInstance = new opts.Vue(appOptions);
      if (currentInstance.vueInstance?.bind) {
        currentInstance.vueInstance = currentInstance.vueInstance?.bind(
          currentInstance.vueInstance,
        );
      }
      if (currentInstance.vueInstance === undefined) {
        throw Error("single-spa-vue: vueInstance is undefined");
      }
      if (opts.handleInstance) {
        await opts.handleInstance(currentInstance.vueInstance, props);
        mountedInstances[props.name] = currentInstance;
        return currentInstance.vueInstance;
      } else {
        mountedInstances[props.name] = instance;
        return currentInstance.vueInstance;
      }
    }
  };

  const bootstrap = async (opts: SingleSpaVueOpts) => {
    if (opts.loadRootComponent) {
      const root = await opts.loadRootComponent();
      return (opts.rootComponent = root);
    } else {
      return Promise.resolve();
    }
  };

  const update = async (
    opts: SingleSpaVueOpts,
    mountedInstances: Record<string, Instance>,
    props: ExtraProps & AppProps,
  ) => {
    return new Promise((resolve) => {
      const instance = mountedInstances[props.name];
      const optsAppOptions = opts.appOptions as AppOptionsObject;

      if (!instance) {
        resolve(null);
      }

      const data: ExtraProps = {
        ...(optsAppOptions.data || {}),
        ...props,
      };

      const root = instance.root || instance.vueInstance;
      for (const prop in data) {
        root[prop] = data[prop];
      }
      resolve(null);
    });
  };

  const unmount = async (
    opts: SingleSpaVueOpts,
    mountedInstances: Record<string, Instance>,
    props: ExtraProps & AppProps,
  ) => {
    return new Promise((resolve) => {
      const instance = mountedInstances[props.name];
      if (!mountedInstances[props.name]) {
        resolve(mountedInstances);
      }

      if (isVue3(opts)) {
        const currentInstance = instance as InstanceVue3;
        currentInstance.vueInstance?.unmount();
      } else {
        const currentInstance = instance as InstanceVue2;
        currentInstance.vueInstance?.$destroy();
      }
      delete instance.vueInstance;

      if (instance.domEl) {
        instance.domEl.innerHTML = "";
        delete instance.domEl;
      }

      // Delete the instance completely
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete mountedInstances[props.name];
      resolve(mountedInstances);
    });
  };

  const mountedInstances: Record<string, Instance> = {};

  return {
    bootstrap: () => bootstrap(opts),
    mount: (props) => mount(opts, mountedInstances, props),
    unmount: (props) => unmount(opts, mountedInstances, props),
    update: (props) => update(opts, mountedInstances, props),
  };
}
