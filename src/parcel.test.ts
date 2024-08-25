import { mount } from "@vue/test-utils";
import { mountRootParcel, ParcelProps } from "single-spa";
import Parcel from "./parcel.js";
import { VueWrapper } from "@vue/test-utils/dist/vueWrapper";

describe("Parcel", () => {
  let wrapper: VueWrapper<any> | null = null;

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }

    wrapper = null;
  });

  it("should render if config and mountParcel are provided", async () => {
    const wrapper = mount(Parcel, {
      propsData: {
        // @ts-expect-error - for testing we have a very specific config object
        config: createParcelConfig(),
        mountParcel: mountRootParcel,
      },
    });

    await tick();

    expect(wrapper.emitted().parcelMounted).toBeTruthy();

    expect(wrapper.find("button#parcel").exists()).toBe(true);
    expect(wrapper.find("button#parcel").text()).toEqual("The parcel button");
  });

  it("should wrap with to div if no 'wrapWith' is provided", async () => {
    const wrapper = mount(Parcel, {
      propsData: {
        // @ts-expect-error - for testing we have a very specific config object
        config: createParcelConfig(),
        mountParcel: mountRootParcel,
      },
    });

    await tick();

    expect(wrapper.emitted().parcelMounted).toBeTruthy();

    expect(wrapper.find("div").exists()).toBe(true);
  });

  it("should respect the wrapWith, wrapClass, and wrapStyle props", async () => {
    wrapper = mount(Parcel, {
      propsData: {
        // @ts-expect-error - for testing we have a very specific config object
        config: createParcelConfig(),
        wrapWith: "span",
        wrapClass: "the-class",
        wrapStyle: {
          backgroundColor: "red",
        },
        mountParcel: mountRootParcel,
      },
    });

    await tick();

    expect(wrapper.emitted().parcelMounted).toBeTruthy();

    expect(wrapper.find("span").exists()).toBe(true);
    expect(wrapper.find("span").classes()).toContain("the-class");
    expect(wrapper.find("span").attributes("style")).toEqual(
      "background-color: red;",
    );

    expect(wrapper.find("span").find("button#parcel").exists()).toBe(true);
    expect(wrapper.find("span").find("button#parcel").text()).toBe(
      "The parcel button",
    );
  });

  it("should unmount properly", async () => {
    const config = createParcelConfig();
    const wrapper = mount(Parcel, {
      propsData: {
        // @ts-expect-error - For testing we have a very specific config object
        config,
        mountParcel: mountRootParcel,
      },
    });
    await tick();

    expect(wrapper.emitted().parcelMounted).toBeTruthy();
    expect(config.mounted).toBe(true);

    expect(wrapper.find("button#parcel").exists()).toBe(true);

    wrapper.unmount();
    await tick();

    expect(config.mounted).toBe(false);
  });

  it("forwards parcelProps to the parcel", async () => {
    const config = createParcelConfig();
    const wrapper = mount(Parcel, {
      propsData: {
        // @ts-expect-error - for testing we have a very specific config object
        config,
        mountParcel: mountRootParcel,
        parcelProps: {
          foo: "bar",
        },
      },
    });

    await tick();

    expect(wrapper.emitted().parcelMounted).toBeTruthy();
    expect(config.mounted).toBe(true);
    expect(config.props).toMatchObject({ foo: "bar" });
  });

  it("calls parcel.update when update is defined", async () => {
    const config = createParcelConfig({ update: true });

    const wrapper = mount(Parcel, {
      propsData: {
        // @ts-expect-error - for testing we have a very specific config object
        config,
        mountParcel: mountRootParcel,
        parcelProps: {
          numUsers: 10,
        },
      },
    });

    await tick();

    expect(wrapper.emitted().parcelMounted).toBeTruthy();
    expect(config.mounted).toBe(true);
    expect(config.props).toMatchObject({
      numUsers: 10,
    });

    wrapper.setProps({
      parcelProps: {
        numUsers: 100,
      },
    });

    await tick();

    expect(wrapper.emitted().parcelUpdated).toBeTruthy();
    expect(config.props).toMatchObject({
      numUsers: 100,
    });
  });

  it(`doesn't die when the parcel config doesn't have an update function`, async () => {
    const config = createParcelConfig();

    const wrapper = mount(Parcel, {
      propsData: {
        // @ts-expect-error - for testing we have a very specific config object
        config,
        mountParcel: mountRootParcel,
        parcelProps: {
          numUsers: 10,
        },
      },
    });

    await tick();

    expect(wrapper.emitted().parcelMounted).toBeTruthy();
    expect(config.mounted).toBe(true);
    expect(config.props).toMatchObject({
      numUsers: 10,
    });

    wrapper.setProps({
      parcelProps: {
        numUsers: 100,
      },
    });

    await tick();

    expect(wrapper.emitted().parcelUpdated).toBeFalsy();
    expect(config.props).toMatchObject({
      // since the parcel config doesn't have an update function,
      // the numUsers prop on the parcel won't update when the
      // <parcel> vue component updates
      numUsers: 10,
    });
  });

  it(`allows you to pass in a promise that resolves with the config object`, async () => {
    const config = createParcelConfig();

    const wrapper = mount(Parcel, {
      propsData: {
        // @ts-expect-error - for testing we have a very specific config object
        config: Promise.resolve(config),
        mountParcel: mountRootParcel,
      },
    });

    await tick();

    expect(wrapper.emitted().parcelMounted).toBeTruthy();
    expect(config.mounted).toBe(true);
    expect(wrapper.find("button#parcel").exists()).toBe(true);
  });
});

function createParcelConfig(opts = {}) {
  const result = {
    async mount(props: ParcelProps) {
      const button = document.createElement("button");
      button.textContent = `The parcel button`;
      button.id = "parcel";
      props.domElement.appendChild(button);
      result.mounted = true;
      result.props = props;
    },
    async unmount(props: ParcelProps) {
      props.domElement.querySelector("button")?.remove();
      result.mounted = false;
      result.props = props;
    },
    mounted: false,
    props: null,
    numUpdates: 0,
  };

  if (opts.update) {
    result.update = async (props) => {
      result.props = props;
      result.numUpdates++;
    };
  }

  return result;
}

function tick() {
  return new Promise((resolve) => {
    setTimeout(resolve);
  });
}
