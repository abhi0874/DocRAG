# Public documentation corpus v1

Source authors retain copyright. The FastAPI documentation is by Sebastián Ramírez
and contributors and is available under the MIT license; see LICENSE-FastAPI.txt
and https://github.com/fastapi/fastapi/blob/master/LICENSE.
The PostgreSQL documentation is by the PostgreSQL Global Development Group and
contributors; see LICENSE-PostgreSQL.txt and https://www.postgresql.org/about/licence/.

manifest.json records the exact 12 source URLs, page titles, retrieval timestamps,
HTML hashes and extracted-text hashes. PostgreSQL sources use the version 16
documentation branch. The FastAPI website is unversioned; no release version is
inferred from its examples. Its committed snapshot hash identifies the content.

The snapshot utility checks robots.txt with the DocRAG-Evaluation/1.0 user agent,
fetches one page at a time with a pause, and retains both sites' access policies.
Neither policy prohibited these selected documentation paths when fetched.
The FastAPI policy explained content signals but specified no restrictive signal.
TLS verification remains enabled through macOS curl. No private data is included.

Text files contain the article body, excluding global navigation and scripts.
Block boundaries become newlines; visual indentation/formatting is not preserved.
Visible code variants and article diagrams remain as text. This is a text-retrieval
corpus, not an executable copy of the examples. No AI-written summaries replace
source text. Original HTML hashes record provenance; full HTML is not stored.
The committed extracted bytes, rather than a changing website, reproduce ingestion.

Each website forms one application document. The six source pages form six virtual
pages, in manifest page_number order. These are documentation page positions, not
PDF page numbers. chunk_map.json records stable document/source/index/content-hash
mappings from the real chunkPages output. Database-local IDs are kept only in
.local/eval-corpus-map.json. Changing a source snapshot requires a new reviewed
corpus version and baseline; the snapshot tool refuses to overwrite an existing one.
