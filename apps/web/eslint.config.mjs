import { nextConfig } from "@aspirant/config/eslint/next";

// public/draco holds the vendored Draco decoder (minified third-party code).
export default [...nextConfig, { ignores: ["public/draco/**"] }];
