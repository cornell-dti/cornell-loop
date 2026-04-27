import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { callback, start } from "./gmailOAuth";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({ path: "/gmail/oauth/start", method: "GET", handler: start });
http.route({ path: "/gmail/oauth/callback", method: "GET", handler: callback });

export default http;
