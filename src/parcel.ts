import * as Vue from "vue";
import { RenderedComponentProps, Action } from "@/types";
import { Parcel, ParcelConfig, ParcelProps } from "single-spa";

export default Vue.defineComponent({
  props: {
    config: {
      type: Object as () => ParcelConfig,
      required: true,
    },
    mountParcel: {
      type: Function,
      required: true,
    },
    wrapWith: String,
    wrapClass: String,
    wrapStyle: Object,
    parcelProps: Object as () => Record<string, any> & Record<number, any>,
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
    async addThingToDo(action: Action, thing: () => Promise<void>) {
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
      if (this.parcel?.getStatus() === "MOUNTED") {
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
  async mounted() {
    if (!this.config) {
      throw Error(`single-spa-vue: <parcel> component requires a config prop.`);
    }

    if (!this.mountParcel) {
      throw Error(
        `single-spa-vue: <parcel> component requires a mountParcel prop`,
      );
    }

    if (this.config) {
      await this.addThingToDo("mount", this.singleSpaMount);
    }
  },
  async unmounted() {
    await this.addThingToDo("unmount", this.singleSpaUnmount);
  },
  watch: {
    async parcelProps() {
      await this.addThingToDo("update", this.singleSpaUpdate);
    },
  },
});
