---
status: accepted
---

# Hono is the only Tool API

Next.js owns routes, layouts, SEO content, and browser UI; every Tool business request crosses a typed oRPC procedure hosted by Hono. Tool logic is not implemented in Server Actions or Next Route Handlers. This keeps one backend path while preserving an independently deployable Hono service, at the cost of maintaining the Web-to-Hono transport and CORS in the current dual-port development topology.
