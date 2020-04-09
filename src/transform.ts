import { camelCase as camelCaseString } from "camel-case";
import { snakeCase as snakeCaseString } from "snake-case";
import { headerCase as headerCaseString } from "header-case";
import { preserveArrayBrackets, preserveSpecificKeys } from "./decorators";
import { isFormData, isTransformable } from "./util";
import {
  CreateObjectTransformer,
  CreateObjectTransformerOf,
  CreateObjectTransformers,
  Transformable,
  CaseFunction,
  ObjectTransformerOptions,
} from "./types";

const transformObjectUsingCallbackRecursive = (
  data: unknown,
  fn: CaseFunction,
  overwrite: ObjectTransformerOptions["overwrite"]
): unknown => {
  if (!isTransformable(data)) {
    return data;
  }

  /* eslint-disable no-console */
  if (isFormData(data) && !data.entries) {
    if (navigator.product === "ReactNative") {
      console.warn(
        "Be careful that FormData cannot be transformed on React Native. If you intentionally implemented, ignore this kind of warning: https://facebook.github.io/react-native/docs/debugging.html"
      );
    } else {
      console.warn(
        "You must use polyfill of FormData.prototype.entries() on Internet Explorer or Safari: https://github.com/jimmywarting/FormData"
      );
    }
    return data;
  }
  /* eslint-enable no-console */

  const prototype = Object.getPrototypeOf(data);

  const store: Transformable = overwrite
    ? data
    : !prototype
    ? Object.create(null)
    : new prototype.constructor();

  for (const [key, value] of prototype?.entries?.call(data) ||
    Object.entries(data)) {
    if (prototype?.append) {
      prototype.append.call(
        store,
        typeof key === "string" ? fn(key) : key,
        transformObjectUsingCallbackRecursive(value, fn, overwrite)
      );
    } else if (key !== "__proto__") {
      store[fn(typeof key === "string" ? key : `${key}`)] = transformObjectUsingCallbackRecursive(
        value,
        fn,
        overwrite
      );
    }
  }
  return store;
};

const transformObjectUsingCallback = (data: unknown, fn: CaseFunction, options?: ObjectTransformerOptions | boolean): unknown => {
  // Backward compatibility
  options = typeof options === "boolean" ? { overwrite: options } : options;

  const composedFn = preserveSpecificKeys(
    preserveArrayBrackets(fn),
    options?.preservedKeys || []
  );
  return transformObjectUsingCallbackRecursive(data, composedFn, options?.overwrite || false);
};

export const createTransform: CreateObjectTransformer = (fn) => {
  return (data, options): ReturnType<ReturnType<CreateObjectTransformer>> => {
    return transformObjectUsingCallback(data, fn, options);
  };
};

const objectTransformers = {
  snake: createTransform(snakeCaseString),
  camel: createTransform(camelCaseString),
  header: createTransform(headerCaseString),
};

export const createTransformOf: CreateObjectTransformerOf = (functionName, options) => {
  const fn = options?.[functionName];
  return fn ? createTransform(fn) : objectTransformers[functionName];
};
export const createTransforms: CreateObjectTransformers = (options) => {
  const functionNames = Object.keys(objectTransformers) as (keyof typeof objectTransformers)[];
  for (const functionName of functionNames) {
    objectTransformers[functionName] = createTransformOf(functionName, options);
  }
  return objectTransformers;
};
