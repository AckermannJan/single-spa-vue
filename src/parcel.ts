import * as Vue from "vue";

interface RenderedComponentProps {
  ref: string;
  class?: string;
  style?: object;
}

type Actions = "mount" | "unmount" | "update";

interface ParcelProps {
  domElement: HTMLElement;
  [key: string]: unknown;
}

interface Parcel {
  mountPromise: Promise<void>;
  unmount: () => Promise<void>;
  update?: (props: ParcelProps) => Promise<void>;
  getStatus: () => string;
}

export default Vue.defineComponent({
  props: {
    config: [Object, Promise],
    wrapWith: String,
    wrapClass: String,
    wrapStyle: Object,
    mountParcel: {
      type: Function,
      required: true,
    },
    parcelProps: Object,
  },
  render(h: typeof Vue.h | undefined) {
    h = typeof h === "function" ? h : Vue.h;
    const containerTagName: string = this.wrapWith || "div";
    const props: RenderedComponentProps = { ref: "container" };

    if (this.wrapClass) {
      props.class = this.wrapClass;
    }
    if (this.wrapStyle) {
      props.style = this.wrapStyle;
    }
    return h(containerTagName, props);
  },
  data() {
    return {
      hasError: false,
      nextThingToDo: null as Promise<void> | null,
      unmounted: false,
      parcel: null as Parcel | null,
    };
  },
  emits: ["parcelError", "parcelMounted", "parcelUpdated"],
  methods: {
    // Todo: Define the type of the thing function
    // eslint-disable-next-line
    async addThingToDo(action: Actions, thing: Function) {
      if (this.hasError && action !== "unmount") {
        return;
      }

      try {
        await this.nextThingToDo;
        if (this.unmounted && action !== "unmount") {
          return;
        }
        await thing();
      } catch (err) {
        this.nextThingToDo = Promise.resolve();
        this.hasError = true;

        if (err instanceof Error) {
          err.message = `During '${action}', parcel threw an error: ${err.message}`;
        }

        this.$emit("parcelError", err);

        throw err;
      }
    },
    async singleSpaMount() {
      this.parcel = this.mountParcel(
        this.config,
        this.getParcelProps(),
      ) as Parcel;

      await this.parcel.mountPromise;
      this.$emit("parcelMounted");
    },
    async singleSpaUnmount() {
      if (this.parcel?.getStatus() === "mounted") {
        await this.parcel.unmount();
      }
    },
    async singleSpaUpdate() {
      if (this.parcel?.update) {
        await this.parcel.update(this.getParcelProps());
        this.$emit("parcelUpdated");
      }
    },
    getParcelProps(): ParcelProps {
      const { container } = this.$refs;
      return {
        domElement: container as HTMLElement,
        ...(this.parcelProps || {}),
      };
    },
  },
  mounted() {
    if (!this.config) {
      throw Error(`single-spa-vue: <parcel> component requires a config prop.`);
    }

    if (!this.mountParcel) {
      throw Error(
        `single-spa-vue: <parcel> component requires a mountParcel prop`,
      );
    }

    if (this.config) {
      this.addThingToDo("mount", this.singleSpaMount);
    }
  },
  unmounted() {
    this.addThingToDo("unmount", this.singleSpaUnmount);
  },
  watch: {
    parcelProps() {
      this.addThingToDo("update", this.singleSpaUpdate);
    },
  },
});
