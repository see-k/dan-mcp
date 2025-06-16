import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Define our MCP agent with tools
export class MyMCP extends McpAgent<Env, unknown, { myToken?: string }> {
	server = new McpServer({
		name: "Authless Calculator",
		version: "1.0.0",
	});

	async init() {
		// Prompt agent tool - makes API call to Node Enterprise
		this.server.tool(
			"prompt-agent",
			{
				node_id: z.string().describe("The node ID for the API endpoint"),
				prompt_message: z.string().describe("The prompt message to send to the agent")
			},
			async ({ node_id, prompt_message }) => {
				const token = (this as any).props.myToken as string;
				if (!token) {
					return {
						content: [{ type: "text", text: "Error: No authorization token found. Please ensure the Authorization header is set." }],
					};
				}

				try {
					const response = await fetch(`https://api.nodeenterprise.ai/api/chat/${node_id}`, {
						method: 'POST',
						headers: {
							'accept': 'application/json',
							'Authorization': token,
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							prompt: prompt_message
						})
					});

					if (!response.ok) {
						return {
							content: [{ type: "text", text: `Error: API request failed with status ${response.status}: ${response.statusText}` }],
						};
					}

					const data = await response.json();
					return {
						content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
					};
				} catch (error) {
					return {
						content: [{ type: "text", text: `Error making API request: ${error instanceof Error ? error.message : 'Unknown error'}` }],
					};
				}
			}
		);
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);
		const authHeader = request.headers.get("authorization");
		
		console.log({authHeader})
		
		const token = authHeader?.split(/\s+/)[1] ?? "";
		ctx.props.myToken = token;
		
		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			// @ts-ignore
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
