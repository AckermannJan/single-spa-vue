import singleSpaVue, { Props } from "./single-spa-vue";
import { Mock, MockInstance } from "vitest";
// @ts-expect-error - `css.escape` has no types
import cssEscape from "css.escape";
import type { VueConstructor } from "vue2";

const domElId = `single-spa-application:test-app`;
const cssSelector = `#single-spa-application\\:test-app`;

interface ExtendedWindow extends Window {
  appMock: {
    mount: Mock;
    unmount: Mock;
  };
}

interface This {
  $destroy: Mock;
  $el: { innerHTML: string };
}

describe("single-spa-vue", () => {
  let Vue: Mock, props: Props, $destroy: Mock;

  vi.stubGlobal("CSS", {
    escape: (str: string) => cssEscape(str),
  });

  beforeEach(() => {
    Vue = vi.fn();

    Vue.mockImplementation(function (this: This) {
      (this as This).$destroy = $destroy;
      (this as This).$el = { innerHTML: "" };
    });

    props = { name: "test-app", mountParcel: vi.fn(), singleSpa: vi.fn() };

    $destroy = vi.fn();
  });

  afterEach(() => {
    document.querySelectorAll(cssSelector).forEach((node) => {
      node.remove();
    });
  });

  it(`calls new Vue() during mount and mountedInstances.instance.$destroy() on unmount`, async () => {
    const handleInstance = vi.fn();

    const lifecycles = singleSpaVue({
      Vue: Vue as unknown as VueConstructor,
      appOptions: {},
      handleInstance,
    });
    await lifecycles.bootstrap();
    expect(Vue).not.toHaveBeenCalled();
    expect(handleInstance).not.toHaveBeenCalled();
    expect($destroy).not.toHaveBeenCalled();
    await lifecycles.mount(props);
    expect(Vue).toHaveBeenCalled();
    expect(handleInstance).toHaveBeenCalled();
    expect($destroy).not.toHaveBeenCalled();
    await lifecycles.unmount(props);
    expect($destroy).toHaveBeenCalled();
  });

  it(`creates a dom element container for you if you don't provide one`, async () => {
    const lifecycles = singleSpaVue({
      Vue: Vue as unknown as VueConstructor,
      appOptions: {},
    });

    expect(document.getElementById(domElId)).toBe(null);
    await lifecycles.bootstrap();
    await lifecycles.mount(props);
    expect(document.getElementById(domElId)).toBeTruthy();
  });

  it(`uses the appOptions.el selector string if provided, and wraps the single-spa application in a container div`, async () => {
    document.body.appendChild(
      Object.assign(document.createElement("div"), {
        id: "my-custom-el",
      }),
    );

    const lifecycles = singleSpaVue({
      Vue: Vue as unknown as VueConstructor,
      appOptions: {
        el: "#my-custom-el",
      },
    });

    expect(document.querySelector(`#my-custom-el .single-spa-container`)).toBe(
      null,
    );
    await lifecycles.bootstrap();
    await lifecycles.mount(props);
    expect(
      document.querySelector(`#my-custom-el .single-spa-container`),
    ).toBeTruthy();
    document.querySelector("#my-custom-el")?.remove();
  });

  it(`uses the appOptions.el domElement (with id) if provided, and wraps the single-spa application in a container div`, async () => {
    const domEl = Object.assign(document.createElement("div"), {
      id: "my-custom-el-2",
    });

    document.body.appendChild(domEl);

    const lifecycles = singleSpaVue({
      Vue: Vue as unknown as VueConstructor,
      appOptions: {
        el: domEl,
      },
    });

    expect(
      document.querySelector(`#my-custom-el-2 .single-spa-container`),
    ).toBe(null);
    await lifecycles.bootstrap();
    await lifecycles.mount(props);
    expect(Vue).toHaveBeenCalled();
    expect(Vue.mock.calls[0][0].el).toBe(
      "#my-custom-el-2 .single-spa-container",
    );
    expect(Vue.mock.calls[0][0].data().name).toEqual("test-app");
    expect(
      document.querySelector(`#my-custom-el-2 .single-spa-container`),
    ).toBeTruthy();
    domEl.remove();
  });

  it(`uses the appOptions.el domElement (without id) if provided, and wraps the single-spa application in a container div`, async () => {
    const domEl = document.createElement("div");

    document.body.appendChild(domEl);

    const lifecycles = singleSpaVue({
      Vue: Vue as unknown as VueConstructor,
      appOptions: {
        el: domEl,
      },
    });

    const htmlId = CSS.escape("single-spa-application:test-app");
    await lifecycles.bootstrap();
    await lifecycles.mount(props);
    expect(Vue.mock.calls[0][0].el).toBe(`#${htmlId} .single-spa-container`);
    expect(Vue.mock.calls[0][0].data().name).toEqual("test-app");
    expect(
      document.querySelector(`#${htmlId} .single-spa-container`),
    ).toBeTruthy();
    domEl.remove();
  });

  it(`throws an error if appOptions.el is not passed in as a string or dom element`, () => {
    expect(() => {
      singleSpaVue({
        Vue: Vue as unknown as VueConstructor,
        appOptions: {
          // @ts-expect-error - `el` should be a string or DOM Element
          el: 1233,
        },
      });
    }).toThrow(/must be a string CSS selector/);
  });

  it(`throws an error if appOptions.el doesn't exist in the dom`, async () => {
    const lifecycles = singleSpaVue({
      Vue: Vue as unknown as VueConstructor,
      appOptions: {
        el: "#doesnt-exist-in-dom",
      },
    });

    try {
      await lifecycles.bootstrap();
      await lifecycles.mount(props);
      throw new Error("should throw validation error");
    } catch (err: unknown) {
      expect((err as Error).message).toMatch(
        "the dom element must exist in the dom",
      );
    }
  });

  it(`reuses the default dom element container on the second mount`, async () => {
    const lifecycles = singleSpaVue({
      Vue: Vue as unknown as VueConstructor,
      appOptions: {},
    });

    expect(document.querySelectorAll(cssSelector).length).toBe(0);

    await lifecycles.bootstrap();
    await lifecycles.mount(props);
    expect(document.querySelectorAll(cssSelector).length).toBe(1);
    // @ts-expect-error - We know that .el exists
    const firstEl = Vue.mock.calls[0].el;
    await lifecycles.unmount(props);
    expect(document.querySelectorAll(cssSelector).length).toBe(1);
    Vue.mockReset();
    await lifecycles.mount(props);
    expect(document.querySelectorAll(cssSelector).length).toBe(1);
    // @ts-expect-error - We know that .el exists
    const secondEl = Vue.mock.calls[0].el;
    expect(firstEl).toBe(secondEl);
  });

  it(`passes appOptions straight through to Vue`, () => {
    const appOptions = {
      something: "random",
    };
    const lifecycles = singleSpaVue({
      Vue: Vue as unknown as VueConstructor,
      appOptions,
    });

    return lifecycles
      .bootstrap()
      .then(() => lifecycles.mount(props))
      .then(() => {
        expect(Vue).toHaveBeenCalled();
        expect(Vue.mock.calls[0][0].something).toBeTruthy();
        return lifecycles.unmount(props);
      });
  });

  it(`resolves appOptions from Promise and passes straight through to Vue`, async () => {
    const appOptions = () =>
      Promise.resolve({
        something: "random",
      });

    const lifecycles = singleSpaVue({
      Vue: Vue as unknown as VueConstructor,
      appOptions,
    });
    await lifecycles.bootstrap();
    await lifecycles.mount(props);
    expect(Vue).toHaveBeenCalled();
    expect(Vue.mock.calls[0][0].something).toBeTruthy();
    return lifecycles.unmount(props);
  });

  it(`appOptions function will receive the props provided at mount`, async () => {
    const appOptions = vi.fn((opts, props) =>
      Promise.resolve({
        props,
        opts,
      }),
    );

    const lifecycles = singleSpaVue({
      Vue: Vue as unknown as VueConstructor,
      appOptions,
    });
    await lifecycles.bootstrap();
    await lifecycles.mount(props);
    expect(appOptions.mock.calls[0][1]).toBe(props);
    return lifecycles.unmount(props);
  });

  it("`handleInstance` function will recieve the props provided at mount", async () => {
    const handleInstance = vi.fn();
    const lifecycles = singleSpaVue({
      Vue: Vue as unknown as VueConstructor,
      appOptions: {},
      handleInstance,
    });
    await lifecycles.bootstrap();
    await lifecycles.mount(props);
    expect(handleInstance.mock.calls[0][1]).toBe(props);
    return lifecycles.unmount(props);
  });

  it(`implements a render function for you if you provide loadRootComponent`, async () => {
    const opts = {
      Vue: Vue as unknown as VueConstructor,
      appOptions: {},
      loadRootComponent: vi.fn(),
    };

    opts.loadRootComponent.mockReturnValue(Promise.resolve({}));

    const lifecycles = singleSpaVue(opts);
    await lifecycles.bootstrap();
    expect(opts.loadRootComponent).toHaveBeenCalled();
    await lifecycles.mount(props);
    expect(Vue.mock.calls[0][0].render).toBeDefined();
    return lifecycles.unmount(props);
  });

  it(`adds the single-spa props as data to the root component`, async () => {
    props.someCustomThing = "hi";

    const lifecycles = singleSpaVue({
      Vue: Vue as unknown as VueConstructor,
      appOptions: {},
    });
    await lifecycles.bootstrap();
    await lifecycles.mount(props);
    expect(Vue).toHaveBeenCalled();
    expect(Vue.mock.calls[0][0].data()).toBeTruthy();
    expect(Vue.mock.calls[0][0].data().name).toBe("test-app");
    expect(Vue.mock.calls[0][0].data().someCustomThing).toBe("hi");
    return lifecycles.unmount(props);
  });

  it(`mounts into the single-spa-container div if you don't provide an 'el' in appOptions`, async () => {
    const lifecycles = singleSpaVue({
      Vue: Vue as unknown as VueConstructor,
      appOptions: {},
    });
    await lifecycles.bootstrap();
    await lifecycles.mount(props);
    expect(Vue).toHaveBeenCalled();
    expect(Vue.mock.calls[0][0].el).toBe(
      cssSelector + " .single-spa-container",
    );
    return lifecycles.unmount(props);
  });

  it(`mounts will return promise with vue instance`, async () => {
    const lifecycles = singleSpaVue({
      Vue: Vue as unknown as VueConstructor,
      appOptions: {},
    });
    await lifecycles.bootstrap();
    const instance = await lifecycles.mount(props);
    expect(Vue).toHaveBeenCalled();
    expect(instance instanceof Vue).toBeTruthy();

    return lifecycles.unmount(props);
  });

  it(`mounts 2 instances and then unmounts them`, async () => {
    const lifecycles = singleSpaVue({
      Vue: Vue as unknown as VueConstructor,
      appOptions: {},
    });

    const obj1 = {
      props: props as Props,
      spy: undefined,
    };
    const obj2 = {
      props: { name: "test-app-2", mountParcel: vi.fn(), singleSpa: vi.fn() },
      spy: undefined,
    };

    async function mount(obj: { props: Props; spy?: MockInstance }) {
      const instance = await lifecycles.mount(obj.props);
      expect(instance instanceof Vue).toBeTruthy();
      const oldDestroy = (instance as Vue).$destroy;
      (instance as Vue).$destroy = (...args) => {
        return oldDestroy.apply(instance, args);
      };
      // @ts-expect-error - We know that $destroy exists
      obj.spy = vi.spyOn(instance, "$destroy");
    }

    async function unmount(obj: { props: Props; spy?: MockInstance }) {
      expect(obj.spy).not.toBeCalled();
      await lifecycles.unmount(obj.props);
      expect(obj.spy).toBeCalled();
    }

    await lifecycles.bootstrap();
    await mount(obj1);
    await mount(obj2);
    await unmount(obj1);
    return unmount(obj2);
  });

  it(`works with Vue 3 when you provide the full Vue module as an opt`, async () => {
    (Vue as unknown as { createApp: Mock }) = {
      createApp: vi.fn(),
    };

    const appMock = {
      mount: vi.fn(),
      unmount: vi.fn(),
    };

    (window as unknown as ExtendedWindow).appMock = appMock;

    (Vue as unknown as { createApp: Mock }).createApp.mockReturnValue(appMock);

    const props = {
      name: "vue3-app",
      mountParcel: vi.fn(),
      singleSpa: vi.fn(),
    };

    const handleInstance = vi.fn();

    const lifecycles = singleSpaVue({
      Vue: Vue as unknown as VueConstructor,
      appOptions: {},
      handleInstance,
    });

    await lifecycles.bootstrap();
    await lifecycles.mount(props);

    expect(
      (Vue as unknown as { createApp: Mock }).createApp,
    ).toHaveBeenCalled();
    // Vue 3 requires the data to be a function
    expect(
      typeof (Vue as unknown as { createApp: Mock }).createApp.mock.calls[0][0]
        .data,
    ).toBe("function");
    expect(handleInstance).toHaveBeenCalledWith(appMock, props);
    expect(appMock.mount).toHaveBeenCalled();

    await lifecycles.unmount(props);
    expect(appMock.unmount).toHaveBeenCalled();
  });

  it(`works with Vue 3 when you provide the createApp function opt`, async () => {
    const createApp = vi.fn();

    const appMock = {
      mount: vi.fn(),
      unmount: vi.fn(),
    };

    (window as unknown as ExtendedWindow).appMock = appMock;

    createApp.mockReturnValue(appMock);

    const props: Props = {
      name: "vue3-app",
      mountParcel: vi.fn(),
      singleSpa: vi.fn(),
    };

    const handleInstance = vi.fn();

    const lifecycles = singleSpaVue({
      createApp,
      appOptions: {},
      handleInstance,
    });

    await lifecycles.bootstrap();
    await lifecycles.mount(props);

    expect(createApp).toHaveBeenCalled();
    // Vue 3 requires the data to be a function
    expect(typeof createApp.mock.calls[0][0].data).toBe("function");
    expect(handleInstance).toHaveBeenCalledWith(appMock, props);
    expect(appMock.mount).toHaveBeenCalled();

    await lifecycles.unmount(props);
    expect(appMock.unmount).toHaveBeenCalled();
  });

  it(`support async handleInstance with creatApp to allow App resolve all children routes before rehydration`, async () => {
    const createApp = vi.fn();

    const appMock = {
      mount: vi.fn(),
      unmount: vi.fn(),
    };

    (window as unknown as ExtendedWindow).appMock = appMock;

    createApp.mockReturnValue(appMock);

    const props: Props = {
      name: "vue3-app",
      mountParcel: vi.fn(),
      singleSpa: vi.fn(),
    };

    let handleInstancePromise;

    const handleInstance = vi.fn(async () => {
      handleInstancePromise = new Promise((resolve) => {
        setTimeout(resolve);
      });

      await handleInstancePromise;
    });

    const lifecycles = singleSpaVue({
      createApp,
      appOptions: {},
      handleInstance,
    });

    await lifecycles.bootstrap();
    await lifecycles.mount(props);

    expect(handleInstance).toHaveBeenCalledWith(appMock, props);
    expect(createApp).toHaveBeenCalled();
    // Vue 3 requires the data to be a function
    expect(typeof createApp.mock.calls[0][0].data).toBe("function");
    expect(appMock.mount).toHaveBeenCalled();

    await lifecycles.unmount(props);
    expect(appMock.unmount).toHaveBeenCalled();
  });

  it(`support async handleInstance without createApp to allow App resolve all children routes before rehydration`, async () => {
    let handleInstancePromise;

    const handleInstance = vi.fn(async () => {
      handleInstancePromise = new Promise((resolve) => {
        setTimeout(resolve);
      });

      await handleInstancePromise;
    });

    const lifecycles = singleSpaVue({
      Vue: Vue as unknown as VueConstructor,
      appOptions: {},
      handleInstance,
    });

    await lifecycles.bootstrap();
    await lifecycles.mount(props);
    expect(handleInstance).toHaveBeenCalled();
    await lifecycles.unmount(props);
  });

  it(`mounts a Vue instance in specified element, if replaceMode is true`, async () => {
    const domEl = document.createElement("div");
    const htmlId = CSS.escape("single-spa-application:test-app");

    document.body.appendChild(domEl);

    const lifecycles = singleSpaVue({
      Vue: Vue as unknown as VueConstructor,
      appOptions: {
        el: domEl,
      },
      replaceMode: true,
    });
    await lifecycles.bootstrap();
    await lifecycles.mount(props);
    expect(Vue.mock.calls[0][0].el).toBe(`#${htmlId}`);
    expect(document.querySelector(`#${htmlId}`)).toBeTruthy();
    domEl.remove();
  });

  it(`mounts a Vue instance with ' .single-spa-container' if replaceMode is false or not provided`, async () => {
    const domEl = document.createElement("div");
    const htmlId = CSS.escape("single-spa-application:test-app");

    document.body.appendChild(domEl);

    const lifecycles = singleSpaVue({
      Vue: Vue as unknown as VueConstructor,
      appOptions: {
        el: domEl,
      },
    });
    await lifecycles.bootstrap();
    await lifecycles.mount(props);
    expect(Vue.mock.calls[0][0].el).toBe(`#${htmlId} .single-spa-container`);
    expect(
      document.querySelector(`#${htmlId} .single-spa-container`),
    ).toBeTruthy();
    domEl.remove();
  });
});
