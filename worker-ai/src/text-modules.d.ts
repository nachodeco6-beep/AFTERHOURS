// wrangler.toml and the test bundle load Markdown as a string.
declare module '*.md' {
  const text: string
  export default text
}
