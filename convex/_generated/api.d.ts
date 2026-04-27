/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _shared_adminToken from "../_shared/adminToken.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as gmailConnection from "../gmailConnection.js";
import type * as gmailOAuth from "../gmailOAuth.js";
import type * as http from "../http.js";
import type * as ingestion from "../ingestion.js";
import type * as listservAdmin from "../listservAdmin.js";
import type * as parser from "../parser.js";
import type * as sourceAdmin from "../sourceAdmin.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_shared/adminToken": typeof _shared_adminToken;
  auth: typeof auth;
  crons: typeof crons;
  gmailConnection: typeof gmailConnection;
  gmailOAuth: typeof gmailOAuth;
  http: typeof http;
  ingestion: typeof ingestion;
  listservAdmin: typeof listservAdmin;
  parser: typeof parser;
  sourceAdmin: typeof sourceAdmin;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
