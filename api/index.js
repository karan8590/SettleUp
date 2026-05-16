import server from "../dist/server/server.js";
import { toNodeHandler } from "srvx/node";

export default toNodeHandler(server.fetch);