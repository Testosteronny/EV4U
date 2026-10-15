/** Serialize a schema.org object for an inline
 *  `<script type="application/ld+json" set:html>`.
 *
 *  `JSON.stringify` does not escape `<`, so seller-controlled text (a listing
 *  note, a model name) containing `</script>` would close the tag and inject
 *  markup into the prerendered page. Escaping `<`, `>` and `&` as JSON
 *  unicode escapes keeps the payload byte-for-byte equivalent to a JSON
 *  parser while making it inert to the HTML parser. U+2028/U+2029 are
 *  escaped too: valid in JSON, line terminators in older JS engines. */
export function jsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/[\u2028]/g, "\\u2028")
    .replace(/[\u2029]/g, "\\u2029");
}
