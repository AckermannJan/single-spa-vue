import type {
  App,
  Component,
  ComponentOptions,
  ComponentPublicInstance,
  CreateAppFunction,
  Vue2,
} from "vue-demi";
import { AppProps, LifeCycleFn, ParcelProps } from "single-spa";

export type Vue = typeof Vue2;

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

export interface Props extends AppProps {
  domElement: HTMLElement;
  [key: string]: unknown;
}

export interface RenderedComponentProps {
  ref: string;
  class?: string;
  style?: object;
}

export type Action = "mount" | "unmount" | "update";

export interface VueLifecycles<ExtraProps> {
  bootstrap: LifeCycleFn<ExtraProps>;
  mount: LifeCycleFn<ExtraProps & ParcelProps>;
  unmount: LifeCycleFn<ExtraProps>;
  update: LifeCycleFn<ExtraProps>;
}
