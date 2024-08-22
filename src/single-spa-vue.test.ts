import singleSpaVue, { InstanceVue2, Props } from "./single-spa-vue";
import { expect, Mock, MockInstance } from "vitest";
// @ts-expect-error - `css.escape` has no types
import cssEscape from "css.escape";
import type { VueConstructor } from "vue2";
import Vue from "vue2";
import { createApp, h } from "vue";

const domElId = `single-spa-application:test-app`;
const cssSelector = `#single-spa-application\\:test-app`;

interface ExtendedWindow extends Window {
  appMock: {
    mount: Mock;
    unmount: Mock;
  };
}

describe("single-spa-vue", () => {
  let props: Props;

  vi.stubGlobal("CSS", {
    escape: (str: string) => cssEscape(str),
  });

  beforeEach(() => {
    props = { name: "test-app", mountParcel: vi.fn(), singleSpa: vi.fn() };
  });

  afterEach(() => {
    document.querySelectorAll(cssSelector).forEach((node) => {
      node.remove();
    });
  });

  it(`calls new Vue() during mount and mountedInstances.instance.$destroy() on unmount`, async () => {
    const handleInstance = vi.fn();

    const lifecycles = singleSpaVue({
      vueVersion: 2,
      Vue,
      appOptions: {
        render: (h) => h("div", "test-app"),
      },
      handleInstance,
    });
    await lifecycles.bootstrap();
    expect(document.body.innerHTML).toBe("");
    expect(handleInstance).not.toHaveBeenCalled();
    await lifecycles.mount(props);
    expect(document.body.innerHTML).toMatchSnapshot();
    expect(handleInstance).toHaveBeenCalled();
    await lifecycles.unmount(props);
    expect(document.body.innerHTML).toMatchSnapshot();
  });

  it("passes extra data to Vue instance as a function", async () => {
    const handleInstance = vi.fn();

    const lifecycles = singleSpaVue({
      vueVersion: 2,
      Vue,
      appOptions: {
        render: (h) => h("div", "test-app"),
        data() {
          return {
            customData: "customData",
          };
        },
      },
      handleInstance,
    });

    await lifecycles.bootstrap();
    const instance = await lifecycles.mount(props);

    expect(instance._data.customData).toBe("customData");
    await lifecycles.unmount(props);
  });

  it("passes extra data to Vue instance as an object", async () => {
    const handleInstance = vi.fn();

    const lifecycles = singleSpaVue({
      vueVersion: 2,
      Vue,
      appOptions: {
        render: (h) => h("div", "test-app"),
        data: {
          customData: "customData",
        },
      },
      handleInstance,
    });

    await lifecycles.bootstrap();
    const instance = await lifecycles.mount(props);

    expect(instance._data.customData).toBe("customData");
    await lifecycles.unmount(props);
  });

  it(`creates a dom element container for you if you don't provide one`, async () => {
    const lifecycles = singleSpaVue({
      vueVersion: 2,
      Vue,
      appOptions: {
        render: (h) => h("div", "test-app"),
      },
    });

    expect(document.getElementById(domElId)).toBe(null);
    await lifecycles.bootstrap();
    await lifecycles.mount(props);
    expect(document.getElementById(domElId)).toBeTruthy();
    await lifecycles.unmount(props);
  });

  it(`uses the appOptions.el selector string if provided, and wraps the single-spa application in a container div`, async () => {
    document.body.appendChild(
      Object.assign(document.createElement("div"), {
        id: "my-custom-el",
      }),
    );

    const lifecycles = singleSpaVue({
      vueVersion: 2,
      Vue,
      appOptions: {
        el: "#my-custom-el",
        render: (h) => h("div", { class: "test" }, "test-app"),
      },
    });

    expect(document.querySelector(`#my-custom-el .test`)).toBe(null);
    await lifecycles.bootstrap();
    await lifecycles.mount(props);
    expect(document.querySelector(`#my-custom-el .test`)).toBeTruthy();
    await lifecycles.unmount(props);
    document.querySelector("#my-custom-el")?.remove();
  });

  it(`uses the appOptions.el domElement (with id) if provided, and wraps the single-spa application in a container div`, async () => {
    const domEl = Object.assign(document.createElement("div"), {
      id: "my-custom-el-2",
    });

    document.body.appendChild(domEl);

    const lifecycles = singleSpaVue({
      vueVersion: 2,
      Vue,
      appOptions: {
        el: domEl,
        render: (h) => h("div", { class: "test" }, "test-app"),
      },
    });

    expect(document.querySelector(`#my-custom-el-2 .test`)).toBe(null);
    await lifecycles.bootstrap();
    const instance = (await lifecycles.mount(props)) as Vue;
    expect(instance.$options.el).toBe("#my-custom-el-2 .single-spa-container");
    expect(instance._data.name).toEqual("test-app");
    expect(document.querySelector(`#my-custom-el-2 .test`)).toBeTruthy();
    document.querySelector("#my-custom-el-2")?.remove();
    await lifecycles.unmount(props);
  });

  it(`uses the appOptions.el domElement (without id) if provided, and wraps the single-spa application in a container div`, async () => {
    const domEl = document.createElement("div");

    document.body.appendChild(domEl);

    const lifecycles = singleSpaVue({
      vueVersion: 2,
      Vue,
      appOptions: {
        el: domEl,
        render: (h) => h("div", { class: "test" }, "test-app"),
      },
    });

    const htmlId = CSS.escape("single-spa-application:test-app");
    await lifecycles.bootstrap();
    const instance = await lifecycles.mount(props);
    expect(instance.$options.el).toBe(`#${htmlId} .single-spa-container`);
    expect(instance._data.name).toEqual("test-app");
    expect(document.querySelector(`#${htmlId} .test`)).toBeTruthy();
    await lifecycles.unmount(props);
  });

  it("uses props.domElement if provided and there is no appOptions.el", async () => {
    const domEl = document.createElement("div");
    const htmlId = CSS.escape("single-spa-application:specific-test-app");
    const testProps = {
      name: "specific-test-app",
      mountParcel: vi.fn(),
      singleSpa: vi.fn(),
    };

    document.body.appendChild(domEl);

    const lifecycles = singleSpaVue({
      vueVersion: 2,
      Vue,
      appOptions: {
        render: (h) => h("div", { class: "test" }, "test-app"),
      },
    });

    await lifecycles.bootstrap();
    const instance = await lifecycles.mount({
      ...testProps,
      domElement: domEl,
    });
    expect(instance.$options.el).toBe(`#${htmlId} .single-spa-container`);
    expect(document.querySelector(`#${htmlId} .test`)).toBeTruthy();
    await lifecycles.unmount({ ...testProps, domElement: domEl });
    expect(document.querySelector(`#${htmlId} .test`)).toBeFalsy();
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
    } catch (err: unknown) {
      expect((err as Error).message).toMatch(
        "the dom element must exist in the dom",
      );
    }
  });

  it(`reuses the default dom element container on the second mount`, async () => {
    let instance: Vue;
    const lifecycles = singleSpaVue({
      vueVersion: 2,
      Vue,
      appOptions: {
        render: (h) => h("div", { class: "test" }, "test-app"),
      },
    });

    expect(document.querySelectorAll(cssSelector).length).toBe(0);

    await lifecycles.bootstrap();
    instance = (await lifecycles.mount(props)) as Vue;
    expect(document.querySelectorAll(cssSelector).length).toBe(1);
    const firstEl = instance.$options.el;
    await lifecycles.unmount(props);
    expect(document.querySelectorAll(cssSelector).length).toBe(1);
    instance = (await lifecycles.mount(props)) as Vue;
    expect(document.querySelectorAll(cssSelector).length).toBe(1);
    const secondEl = instance.$options.el;
    expect(firstEl).toBe(secondEl);
    await lifecycles.unmount(props);
  });

  it(`passes appOptions straight through to Vue`, async () => {
    const appOptions = {
      something: "random",
      render: (h) => h("div", { class: "test" }, "test-app"),
    };
    const lifecycles = singleSpaVue({
      vueVersion: 2,
      Vue,
      appOptions,
    });
    await lifecycles.bootstrap();
    const instance = (await lifecycles.mount(props)) as Vue;
    expect(instance.$options.something).toBe("random");
    await lifecycles.unmount(props);
  });

  it(`resolves appOptions from Promise and passes straight through to Vue`, async () => {
    const appOptions = () =>
      Promise.resolve({
        something: "random",
        render: (h) => h("div", { class: "test" }, "test-app"),
      });

    const lifecycles = singleSpaVue({
      vueVersion: 2,
      Vue,
      appOptions,
    });
    await lifecycles.bootstrap();
    await lifecycles.mount(props);
    const instance = (await lifecycles.mount(props)) as Vue;
    expect(instance.$options.something).toBe("random");
    return lifecycles.unmount(props);
  });

  it(`appOptions function will receive the props provided at mount`, async () => {
    const appOptions = vi.fn((_opts, localProps) => {
      expect(localProps).toBe(props);
      return Promise.resolve({
        render: (h) => h("div", { class: "test" }, "test-app"),
      });
    });

    const lifecycles = singleSpaVue({
      vueVersion: 2,
      Vue,
      appOptions,
    });

    await lifecycles.bootstrap();
    await lifecycles.mount(props);
    return lifecycles.unmount(props);
  });

  it("`handleInstance` function will receive the props provided at mount", async () => {
    const handleInstance = vi.fn();
    const lifecycles = singleSpaVue({
      vueVersion: 2,
      Vue,
      appOptions: {
        render: (h) => h("div", { class: "test" }, "test-app"),
      },
      handleInstance,
    });
    await lifecycles.bootstrap();
    await lifecycles.mount(props);
    expect(handleInstance.mock.calls[0][1]).toBe(props);
    return lifecycles.unmount(props);
  });

  it(`implements a render function for you if you provide loadRootComponent`, async () => {
    const opts = {
      vueVersion: 2,
      Vue,
      appOptions: {},
      loadRootComponent: vi.fn(),
    };

    opts.loadRootComponent.mockReturnValue(
      Promise.resolve({
        render: (h) => h("div", "test-app"),
      }),
    );

    const lifecycles = singleSpaVue(opts);
    await lifecycles.bootstrap();
    expect(opts.loadRootComponent).toHaveBeenCalled();
    const instance = (await lifecycles.mount(props)) as Vue;
    expect(instance.$options.render).toBeDefined();
    return lifecycles.unmount(props);
  });

  it(`adds the single-spa props as data to the root component`, async () => {
    props.someCustomThing = "hi";

    const lifecycles = singleSpaVue({
      vueVersion: 2,
      Vue,
      appOptions: {
        render: (h) => h("div", "test-app"),
      },
    });
    await lifecycles.bootstrap();
    const instance = (await lifecycles.mount(props)) as Vue;
    expect(instance._data.name).toBe("test-app");
    expect(instance._data.someCustomThing).toBe("hi");
    return lifecycles.unmount(props);
  });

  it(`mounts into the single-spa-container div if you don't provide an 'el' in appOptions`, async () => {
    const lifecycles = singleSpaVue({
      vueVersion: 2,
      Vue: Vue as unknown as VueConstructor,
      appOptions: {
        render: (h) => h("div", "test-app"),
      },
    });
    await lifecycles.bootstrap();
    const instance = (await lifecycles.mount(props)) as Vue;
    expect(instance.$options.el).toBe(cssSelector + " .single-spa-container");
    return lifecycles.unmount(props);
  });

  it(`mounts will return promise with vue instance`, async () => {
    const lifecycles = singleSpaVue({
      vueVersion: 2,
      Vue,
      appOptions: {
        render: (h) => h("div", "test-app"),
      },
    });
    await lifecycles.bootstrap();
    const instance = await lifecycles.mount(props);
    expect(instance instanceof Vue).toBeTruthy();
    await lifecycles.unmount(props);
  });

  it("mounts one instance and tries to unmount it twice without issue", async () => {
    const lifecycles = singleSpaVue({
      vueVersion: 2,
      Vue,
      appOptions: {
        render: (h) => h("div", "test-app"),
      },
    });
    await lifecycles.bootstrap();
    const instance = await lifecycles.mount(props);
    const destroySpy = vi.spyOn(instance, "$destroy");
    await lifecycles.unmount(props);
    await lifecycles.unmount(props);

    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  it(`mounts 2 instances and then unmounts them`, async () => {
    const lifecycles = singleSpaVue({
      vueVersion: 2,
      Vue,
      appOptions: {
        render: (h) => h("div", { class: "test" }, "test-app"),
      },
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
    expect(document.getElementsByClassName("test").length).toBe(1);
    await mount(obj2);
    expect(document.getElementsByClassName("test").length).toBe(2);
    await unmount(obj1);
    expect(document.getElementsByClassName("test").length).toBe(1);
    await unmount(obj2);
    expect(document.getElementsByClassName("test").length).toBe(0);
  });

  it(`works with Vue 3 when you provide the full Vue module as an opt`, async () => {
    const props = {
      name: "vue3-app",
      mountParcel: vi.fn(),
      singleSpa: vi.fn(),
    };

    const handleInstance = vi.fn();

    const lifecycles = singleSpaVue({
      vueVersion: 3,
      Vue: {
        createApp,
      },
      appOptions: {
        render: () => h("div", { class: "test" }, "vue3-test-app"),
      },
      handleInstance,
    });

    await lifecycles.bootstrap();
    await lifecycles.mount(props);
    expect(document.body.innerHTML).toContain("vue3-test-app");
    expect(document.getElementsByClassName("test").length).toBe(1);
    await lifecycles.unmount(props);
    expect(document.body.innerHTML).not.toContain("vue3-test-app");
    expect(document.getElementsByClassName("test").length).toBe(0);
  });

  it(`works with Vue 3 when you provide the createApp function opt`, async () => {
    const props: Props = {
      name: "vue3-app",
      mountParcel: vi.fn(),
      singleSpa: vi.fn(),
    };

    const handleInstance = vi.fn();

    const lifecycles = singleSpaVue({
      vueVersion: 3,
      createApp,
      appOptions: {
        render: () => h("div", { class: "test" }, "vue3-test-app"),
      },
      handleInstance,
    });

    await lifecycles.bootstrap();
    await lifecycles.mount(props);
    expect(document.body.innerHTML).toContain("vue3-test-app");
    expect(document.getElementsByClassName("test").length).toBe(1);

    await lifecycles.unmount(props);
    expect(document.body.innerHTML).not.toContain("vue3-test-app");
    expect(document.getElementsByClassName("test").length).toBe(0);
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
      Vue,
      appOptions: {
        render: (h) => h("div", "test-app"),
      },
      handleInstance,
    });

    await lifecycles.bootstrap();
    await lifecycles.mount(props);
    expect(handleInstance).toHaveBeenCalled();
    await lifecycles.unmount(props);
  });

  it(`does not make use of handleInstance in vue3 application`, async () => {
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

    const lifecycles = singleSpaVue({
      createApp,
      appOptions: {},
    });

    await lifecycles.bootstrap();
    await lifecycles.mount(props);

    expect(createApp).toHaveBeenCalled();
    // Vue 3 requires the data to be a function
    expect(typeof createApp.mock.calls[0][0].data).toBe("function");
    expect(appMock.mount).toHaveBeenCalled();

    await lifecycles.unmount(props);
    expect(appMock.unmount).toHaveBeenCalled();
  });

  it(`mounts a Vue instance in specified element, if replaceMode is true`, async () => {
    const domEl = document.createElement("div");
    const htmlId = CSS.escape("single-spa-application:test-app");

    document.body.appendChild(domEl);

    const lifecycles = singleSpaVue({
      vueVersion: 2,
      Vue,
      appOptions: {
        el: domEl,
        render: (h) => h("div", "test-app"),
      },
      replaceMode: true,
    });
    await lifecycles.bootstrap();
    await lifecycles.mount(props);

    const instance = lifecycles.getMountedInstances()[
      "test-app"
    ] as unknown as InstanceVue2;
    expect(instance.vueInstance?.$options.el).toBe(`#${htmlId}`);
    expect(document.querySelector(`#${htmlId}`)).toBeFalsy();
    expect(document.body.innerHTML).toContain("test-app");
    domEl.remove();
    await lifecycles.unmount(props);
  });

  it(`mounts a Vue instance while not replacing the original domEl if replaceMode is false or not defined`, async () => {
    const domEl = document.createElement("div");
    const htmlId = CSS.escape("single-spa-application:test-app");

    document.body.appendChild(domEl);

    const lifecycles = singleSpaVue({
      vueVersion: 2,
      Vue,
      appOptions: {
        el: domEl,
        render: (h) => h("div", "test-app"),
      },
    });
    await lifecycles.bootstrap();
    await lifecycles.mount(props);
    const instance = lifecycles.getMountedInstances()[
      "test-app"
    ] as unknown as InstanceVue2;
    expect(instance.vueInstance?.$options.el).toBe(
      `#${htmlId} .single-spa-container`,
    );
    expect(document.querySelector(`#${htmlId}`)).toBeTruthy();
    domEl.remove();
    await lifecycles.unmount(props);
  });

  it("should update the existing props of a specific instance", async () => {
    const lifecycles = singleSpaVue({
      vueVersion: 2,
      Vue,
      appOptions: {
        render: (h) => h("div", "test-app"),
      },
    });

    await lifecycles.bootstrap();
    const instance = await lifecycles.mount({
      ...props,
      extraProp: "oldValue",
    });

    const newProps = { ...props, extraProp: "newValue" };
    await lifecycles.update(newProps);

    expect(instance._data.extraProp).toBe("newValue");
    await lifecycles.unmount(props);
  });
});
