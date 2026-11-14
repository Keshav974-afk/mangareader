import { connect } from 'cloudflare:sockets';
import { handleCloudflareRequest } from '../../lib/cloudflare-handler.js';
export function onRequest(context) { return handleCloudflareRequest(context, connect); }
