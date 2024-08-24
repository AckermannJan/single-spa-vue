import type {
  App,
  ComponentPublicInstance,
  Component,
  CreateAppFunction,
  ComponentOptions,
  Vue2,
  h as H,
} from "vue-demi";
type Vue = typeof Vue2;

export interface AppOptionsObject extends ComponentOptions<any> {
  el?: string | HTMLElement;
  [key: string]: unknown;
}

export type AppOptionsFunction = (
  opts: SingleSpaVueOpts,
  props: object,
) => Promise<AppOptionsObject>;

export type AppOptions = AppOptionsObject | AppOptionsFunction;

export interface BaseSingleSpaVueOptions {
  template?: string;
  loadRootComponent?(): Promise<Component>;
  replaceMode?: boolean;
  rootComponent?: Component;
}

export type SingleSpaOptsVue2 = BaseSingleSpaVueOptions & {
  vueVersion: 2;
  appOptions: AppOptions;
  Vue: Vue;
  handleInstance?(app: Vue, props: Props): Promise<void> | void;
};

export type SingleSpaOptsVue3 = BaseSingleSpaVueOptions & {
  vueVersion: 3;
  appOptions: AppOptions;
  createApp: CreateAppFunction<Element>;
  handleInstance?(app: App, props: Props): Promise<void> | void;
};

export type SingleSpaVueOpts = SingleSpaOptsVue2 | SingleSpaOptsVue3;

export interface BaseInstance {
  domEl?: HTMLElement;
  root?: ComponentPublicInstance;
  [key: string]: unknown;
}

export type InstanceVue2 = BaseInstance & {
  vueInstance?: Vue;
};

export type InstanceVue3 = BaseInstance & {
  vueInstance?: App<Element>;
};

export type Instance = InstanceVue2 | InstanceVue3;

export interface Props {
  name: string;
  mountParcel: object; // TODO: Define Parcel type
  singleSpa: object; // TODO: Define SingleSpa type
  domElement: HTMLElement;
  [key: string]: unknown;
}

class SingleSpaVue {
  private readonly opts: SingleSpaVueOpts;

  constructor(userOpts: SingleSpaVueOpts) {
    if (typeof userOpts !== "object") {
      throw new Error(`single-spa-vue requires a configuration object`);
    }

    this.opts = userOpts;

    if (!this.isVue2(this.opts) && !this.isVue3(this.opts)) {
      throw Error("single-spa-vue must be passed opts.Vue or opts.createApp");
    }

    if (
      this.isAppOptionsObject(this.opts.appOptions) &&
      this.opts.appOptions.el &&
      typeof this.opts.appOptions.el !== "string" &&
      !(this.opts.appOptions.el instanceof HTMLElement)
    ) {
      throw Error(
        `single-spa-vue: appOptions.el must be a string CSS selector, an HTMLElement, or not provided at all. Was given ${typeof this
          .opts.appOptions.el}`,
      );
    }

    // @ts-expect-error - If the user has provided createApp via the Vue option, we are moving it to the correct createApp option
    this.opts.createApp =
      // @ts-expect-error - If the user has provided createApp via the Vue option, we are moving it to the correct createApp option
      this.opts.createApp || (this.opts.Vue && this.opts.Vue.createApp);
  }

  private isVue2(opts: SingleSpaVueOpts): opts is SingleSpaOptsVue2 {
    return (opts as SingleSpaOptsVue2).Vue !== undefined;
  }

  private isVue3(opts: SingleSpaVueOpts): opts is SingleSpaOptsVue3 {
    return (opts as SingleSpaOptsVue3).createApp !== undefined;
  }

  private isAppOptionsObject(opts: AppOptions): opts is AppOptionsObject {
    return (opts as AppOptionsObject).el !== undefined;
  }

  private async resolveAppOptions(
    opts: SingleSpaVueOpts,
    props: Props,
  ): Promise<AppOptionsObject> {
    if (typeof opts.appOptions === "function") {
      return (opts.appOptions as AppOptionsFunction)(opts, props);
    } else {
      return Promise.resolve({ ...opts.appOptions });
    }
  }

  public async mount(
    opts: SingleSpaVueOpts,
    mountedInstances: Record<string, Instance>,
    props: Props,
  ): Promise<Vue | App<Element>> {
    await Promise.resolve();
    const instance: Instance = {};
    const appOptions = await this.resolveAppOptions(opts, props);
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
    appOptions.data = () => {
      const data =
        typeof originData === "function"
          ? originData.call(this, this)
          : originData;
      return { ...data, ...props };
    };

    if (this.isVue3(opts)) {
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
  }

  public async unmount(
    opts: SingleSpaVueOpts,
    mountedInstances: Record<string, Instance>,
    props: Props,
  ): Promise<Record<string, Instance>> {
    await Promise.resolve();
    const instance = mountedInstances[props.name];
    if (!mountedInstances[props.name]) {
      return mountedInstances;
    }

    if (this.isVue3(opts)) {
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
    return mountedInstances;
  }

  public async update(
    opts: SingleSpaVueOpts,
    mountedInstances: Record<string, Instance>,
    props: Props,
  ): Promise<void> {
    await Promise.resolve();
    const instance = mountedInstances[props.name];
    const optsAppOptions = opts.appOptions as AppOptionsObject;

    if (!instance) {
      return;
    }

    const data: Props | Pick<AppOptionsObject, "data"> = {
      ...(optsAppOptions.data || {}),
      ...props,
    };

    const root = instance.root || instance.vueInstance;
    for (const prop in data) {
      root[prop] = data[prop];
    }
  }

  public async bootstrap(opts: SingleSpaVueOpts) {
    if (opts.loadRootComponent) {
      const root = await opts.loadRootComponent();
      return (opts.rootComponent = root);
    } else {
      return Promise.resolve();
    }
  }
}

export default function (opts: SingleSpaVueOpts) {
  const singleSpaVue = new SingleSpaVue(opts);
  const mountedInstances: Record<string, Instance> = {};

  return {
    bootstrap: () => singleSpaVue.bootstrap(opts),
    mount: (props: Props) => singleSpaVue.mount(opts, mountedInstances, props),
    unmount: (props: Props) =>
      singleSpaVue.unmount(opts, mountedInstances, props),
    update: (props: Props) =>
      singleSpaVue.update(opts, mountedInstances, props),
  };
}
