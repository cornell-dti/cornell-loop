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
import type * as bookmarks from "../bookmarks.js";
import type * as crons from "../crons.js";
import type * as dev from "../dev.js";
import type * as events from "../events.js";
import type * as follows from "../follows.js";
import type * as gmailConnection from "../gmailConnection.js";
import type * as gmailOAuth from "../gmailOAuth.js";
import type * as http from "../http.js";
import type * as ingestion from "../ingestion.js";
import type * as listservAdmin from "../listservAdmin.js";
import type * as orgs from "../orgs.js";
import type * as parser from "../parser.js";
import type * as rsvps from "../rsvps.js";
import type * as seed from "../seed.js";
import type * as seedData from "../seedData.js";
import type * as sourceAdmin from "../sourceAdmin.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_shared/adminToken": typeof _shared_adminToken;
  auth: typeof auth;
  bookmarks: typeof bookmarks;
  crons: typeof crons;
  dev: typeof dev;
  events: typeof events;
  follows: typeof follows;
  gmailConnection: typeof gmailConnection;
  gmailOAuth: typeof gmailOAuth;
  http: typeof http;
  ingestion: typeof ingestion;
  listservAdmin: typeof listservAdmin;
  orgs: typeof orgs;
  parser: typeof parser;
  rsvps: typeof rsvps;
  seed: typeof seed;
  seedData: typeof seedData;
  sourceAdmin: typeof sourceAdmin;
  users: typeof users;
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
