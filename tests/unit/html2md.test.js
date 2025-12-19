import { convertHtmlToMarkdown } from '../../src/lib.js';

describe('convertHtmlToMarkdown', () => {
  it('removes empty links and anchor headings', () => {
    const html = `
      <a href="/http-api/authorization"></a>
      <a href="/webhooks/authorization"></a>
      <a href="/api-reference/http-api"></a>
      <h3></h3>
      <a href="#quick-start"></a>
      <h3>Quick start</h3>
    `;
    const md = convertHtmlToMarkdown(html);
    // Should not contain empty []() links or [](#anchor) or empty headings
    expect(md).not.toMatch(/\[\s*\]\([^)]*\)/);
    expect(md).not.toMatch(/#+\s*$/m);
    expect(md).not.toMatch(/\[\s*\]\(#.*\)/);
    // Should contain the real heading
    expect(md).toMatch(/### Quick start/);
  });

  it('removes empty links in complex content', () => {
    const html = `
      <div>
        <a href="/foo"></a>
        <a href="/bar">Bar</a>
        <a href="#anchor"></a>
        <h2></h2>
        <h2>Title</h2>
      </div>
    `;
    const md = convertHtmlToMarkdown(html);
    expect(md).not.toMatch(/\[\s*\]\([^)]*\)/);
    expect(md).toMatch(/\[Bar\]\(\/bar\)/);
    expect(md).toMatch(/## Title/);
  });

  it('removes empty links with only whitespace', () => {
    const html = `
      <a href="/foo">   </a>
      <a href="/bar">\n\t</a>
      <a href="#anchor"> </a>
    `;
    const md = convertHtmlToMarkdown(html);
    expect(md).not.toMatch(/\[\s*\]\([^)]*\)/);
    expect(md).not.toMatch(/\[\s*\]\(#.*\)/);
  });

  it('removes empty links with only child elements', () => {
    const html = `
      <a href="/foo"><span></span></a>
      <a href="/bar"><div></div></a>
      <a href="#anchor"><span> </span></a>
      <a href="/baz"><img src='x.png'></a>
      <a href="/qux"><span>\n</span></a>
      <a href="/keep">Text<span>child</span></a>
    `;
    const md = convertHtmlToMarkdown(html);
    expect(md).not.toMatch(/\[\s*\]\([^)]*\)/);
    expect(md).not.toMatch(/\[\s*\]\(#.*\)/);
    expect(md).toMatch(/\[Textchild\]\(\/keep\)/);
  });

  it('removes headings with only whitespace', () => {
    const html = `
      <h2>   </h2>
      <h3>\n\t</h3>
      <h4>\u00A0</h4>
      <h2>Valid Heading</h2>
    `;
    const md = convertHtmlToMarkdown(html);
    expect(md).not.toMatch(/#+\s*$/m);
    expect(md).toMatch(/## Valid Heading/);
  });

  it('converts relative links to absolute if baseUrl is provided', () => {
    const html = `
      <a href="/foo">Foo</a>
      <img src="/bar.png" alt="Bar">
      <a href="https://external.com">External</a>
    `;
    const md = convertHtmlToMarkdown(html, 'https://example.com/base/');
    expect(md).toMatch(/\[Foo\]\(https:\/\/example.com\/foo\)/);
    expect(md).toMatch(/!\[Bar\]\(https:\/\/example.com\/bar.png\)/);
    expect(md).toMatch(/\[External\]\(https:\/\/external.com\/?\)/);
  });

  it('does not change links if no baseUrl is provided', () => {
    const html = `
      <a href="/foo">Foo</a>
      <img src="/bar.png" alt="Bar">
    `;
    const md = convertHtmlToMarkdown(html);
    expect(md).toMatch(/\[Foo\]\(\/foo\)/);
    expect(md).toMatch(/!\[Bar\]\(\/bar.png\)/);
  });

  it('converts ARIA role table to Markdown table', () => {
    const html = `
      <div
        role="table"
        aria-label="Semantic Elements"
        aria-describedby="semantic_elements_table_desc"
        aria-rowcount="81">
        <div id="semantic_elements_table_desc">
          Semantic Elements to use instead of ARIA's roles
        </div>
        <div role="rowgroup">
          <div role="row">
            <span role="columnheader" aria-sort="none">ARIA Role</span>
            <span role="columnheader" aria-sort="none">Semantic Element</span>
          </div>
        </div>
        <div role="rowgroup">
          <div role="row" aria-rowindex="11">
            <span role="cell">header</span>
            <span role="cell">h1</span>
          </div>
          <div role="row" aria-rowindex="16">
            <span role="cell">header</span>
            <span role="cell">h6</span>
          </div>
          <div role="row" aria-rowindex="18">
            <span role="cell">rowgroup</span>
            <span role="cell">thead</span>
          </div>
          <div role="row" aria-rowindex="24">
            <span role="cell">term</span>
            <span role="cell">dt</span>
          </div>
        </div>
      </div>
    `;
    const md = convertHtmlToMarkdown(html);
    // Should contain a Markdown table header
    expect(md).toMatch(/\|\s*ARIA Role\s*\|\s*Semantic Element\s*\|/);
    // Should contain the separator row
    expect(md).toMatch(/\|\s*-+\s*\|\s*-+\s*\|/);
    // Should contain all data rows
    expect(md).toMatch(/\|\s*header\s*\|\s*h1\s*\|/);
    expect(md).toMatch(/\|\s*header\s*\|\s*h6\s*\|/);
    expect(md).toMatch(/\|\s*rowgroup\s*\|\s*thead\s*\|/);
    expect(md).toMatch(/\|\s*term\s*\|\s*dt\s*\|/);
  });

  it('converts a regular HTML table to Markdown table', () => {
    const html = `
      <table>
        <caption>Sample Table</caption>
        <thead>
          <tr>
            <th>Header 1</th>
            <th>Header 2</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Cell 1</td>
            <td>Cell 2</td>
          </tr>
          <tr>
            <td>Cell 3</td>
            <td>Cell 4</td>
          </tr>
        </tbody>
      </table>
    `;
    const md = convertHtmlToMarkdown(html);
    // Should contain a Markdown table header
    expect(md).toMatch(/\|\s*Header 1\s*\|\s*Header 2\s*\|/);
    // Should contain the separator row
    expect(md).toMatch(/\|\s*-+\s*\|\s*-+\s*\|/);
    // Should contain all data rows
    expect(md).toMatch(/\|\s*Cell 1\s*\|\s*Cell 2\s*\|/);
    expect(md).toMatch(/\|\s*Cell 3\s*\|\s*Cell 4\s*\|/);
  });

  it('handles empty tables gracefully', () => {
    const html = `
      <table>
        <thead>
          <tr>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td></td>
            <td></td>
          </tr>
        </tbody>
      </table>
    `;
    const md = convertHtmlToMarkdown(html);
    // Should not throw an error
    // Accept the actual output for an empty table (2 columns, empty header and row)
    expect(md.trim()).toBe('|  |  |\n| --- | --- |\n|  |  |');
  });

  it('handles specific ARIA table example', () => {
    const html = `
<div
  class="mx-auto w-full decoration-primary/6 max-w-3xl page-api-block:ml-0 table_tableWrapper__zr7LC"
>
  <div role="table" class="flex flex-col">
    <div
      role="rowgroup"
      class="w-full table_rowGroup__IKtSP straight-corners:rounded-none"
    >
      <div role="row" class="flex w-full">
        <div
          role="columnheader"
          class="table_columnHeader__PGmsy text-left"
          title="Attribute"
          style="width: 181px; min-width: 181px"
        >
          Attribute
        </div>
        <div
          role="columnheader"
          class="table_columnHeader__PGmsy text-left"
          title="Type"
          style="width: 110px; min-width: 110px"
        >
          Type
        </div>
        <div
          role="columnheader"
          class="table_columnHeader__PGmsy text-left"
          title="Required"
          style="width: 104px; min-width: 104px"
        >
          Required
        </div>
        <div
          role="columnheader"
          class="table_columnHeader__PGmsy text-left"
          title="Description"
          style="width: clamp(100px, 100% - 395px, 100%); min-width: 100px"
        >
          Description
        </div>
      </div>
    </div>
    <div role="rowgroup" class="flex flex-col w-full [&amp;>*+*]:border-t">
      <div class="table_row__LpfCG" role="row">
        <div
          role="cell"
          class="table_cell__X_gFM"
          style="width: 181px; min-width: 181px"
        >
          <div
            class="blocks w-full space-y-2 lg:space-y-3 leading-normal self-center [&amp;_*]:text-left text-left"
          >
            <p class="mx-auto decoration-primary/6 w-full max-w-[unset]">
              amount
            </p>
          </div>
        </div>
        <div
          role="cell"
          class="table_cell__X_gFM"
          style="width: 110px; min-width: 110px"
        >
          <div
            class="blocks w-full space-y-2 lg:space-y-3 leading-normal self-center [&amp;_*]:text-left text-left"
          >
            <p class="mx-auto decoration-primary/6 w-full max-w-[unset]">
              decimal
            </p>
          </div>
        </div>
        <div
          role="cell"
          class="table_cell__X_gFM"
          style="width: 104px; min-width: 104px"
        >
          <div
            class="blocks w-full space-y-2 lg:space-y-3 leading-normal self-center [&amp;_*]:text-left text-left"
          >
            <p class="mx-auto decoration-primary/6 w_full max-w-[unset]">yes</p>
          </div>
        </div>
        <div
          role="cell"
          class="table_cell__X_gFM"
          style="
            width: clamp(100px, 100% - 395px, 100%);
            min-width: clamp(100px, 100% - 395px, 100%);
          "
        >
          <div
            class="blocks w-full space-y-2 lg:space-y-3 leading-normal self-center [&amp;_*]:text-left text-left"
          >
            <p class="mx-auto decoration-primary/6 w_full max-w-[unset]">
              order amount
            </p>
          </div>
        </div>
      </div>
      <div class="table_row__LpfCG" role="row">
        <div
          role="cell"
          class="table_cell__X_gFM"
          style="width: 181px; min-width: 181px"
        >
          <div
            class="blocks w-full space-y-2 lg:space-y-3 leading-normal self-center [&amp;_*]:text-left text-left"
          >
            <p class="mx-auto decoration-primary/6 w_full max-w-[unset]">
              currency_id
            </p>
          </div>
        </div>
        <div
          role="cell"
          class="table_cell__X_gFM"
          style="width: 110px; min-width: 110px"
        >
          <div
            class="blocks w-full space-y-2 lg:space-y-3 leading-normal self-center [&amp;_*]:text-left text-left"
          >
            <p class="mx-auto decoration-primary/6 w_full max-w-[unset]">
              string
            </p>
          </div>
        </div>
        <div
          role="cell"
          class="table_cell__X_gFM"
          style="width: 104px; min-width: 104px"
        >
          <div
            class="blocks w_full space-y-2 lg:space-y-3 leading-normal self-center [&amp;_*]:text-left text-left"
          >
            <p class="mx-auto decoration-primary/6 w_full max-w-[unset]">yes</p>
          </div>
        </div>
        <div
          role="cell"
          class="table_cell__X_gFM"
          style="
            width: clamp(100px, 100% - 395px, 100%);
            min-width: clamp(100px, 100% - 395px, 100%);
          "
        >
          <div
            class="blocks w-full space-y-2 lg:space-y-3 leading-normal self-center [&amp;_*]:text-left text-left"
          >
            <p class="mx-auto decoration-primary/6 w_full max-w-[unset]">
              order currency id
            </p>
          </div>
        </div>
      </div>
      <div class="table_row__LpfCG" role="row">
        <div
          role="cell"
          class="table_cell__X_gFM"
          style="width: 181px; min-width: 181px"
        >
          <div
            class="blocks w-full space-y-2 lg:space-y-3 leading-normal self-center [&amp;_*]:text-left text-left"
          >
            <p class="mx-auto decoration-primary/6 w_full max-w-[unset]">
              network
            </p>
          </div>
        </div>
        <div
          role="cell"
          class="table_cell__X_gFM"
          style="width: 110px; min-width: 110px"
        >
          <div
            class="blocks w-full space-y-2 lg:space-y-3 leading-normal self-center [&amp;_*]:text-left text-left"
          >
            <p class="mx-auto decoration-primary/6 w_full max-w-[unset]">
              string
            </p>
          </div>
        </div>
        <div
          role="cell"
          class="table_cell__X_gFM"
          style="width: 104px; min-width: 104px"
        >
          <div
            class="blocks w_full space-y-2 lg:space-y-3 leading-normal self-center [&amp;_*]:text-left text-left"
          >
            <p class="mx-auto decoration-primary/6 w_full max-w-[unset]">yes</p>
          </div>
        </div>
        <div
          role="cell"
          class="table_cell__X_gFM"
          style="
            width: clamp(100px, 100% - 395px, 100%);
            min-width: clamp(100px, 100% - 395px, 100%);
          "
        >
          <div
            class="blocks w-full space-y-2 lg:space-y-3 leading-normal self-center [&amp;_*]:text-left text-left"
          >
            <p class="mx-auto decoration-primary/6 w_full max-w-[unset]">
              currency network
            </p>
          </div>
        </div>
      </div>
      <div class="table_row__LpfCG" role="row">
        <div
          role="cell"
          class="table_cell__X_gFM"
          style="width: 181px; min-width: 181px"
        >
          <div
            class="blocks w_full space-y-2 lg:space-y-3 leading-normal self-center [&amp;_*]:text-left text-left"
          >
            <p class="mx-auto decoration-primary/6 w_full max-w-[unset]">
              external_order_id
            </p>
          </div>
        </div>
        <div
          role="cell"
          class="table_cell__X_gFM"
          style="width: 110px; min-width: 110px"
        >
          <div
            class="blocks w_full space-y-2 lg:space-y-3 leading-normal self-center [&amp;_*]:text-left text-left"
          >
            <p class="mx-auto decoration-primary/6 w_full max-w-[unset]">
              string
            </p>
          </div>
        </div>
        <div
          role="cell"
          class="table_cell__X_gFM"
          style="width: 104px; min-width: 104px"
        >
          <div
            class="blocks w_full space-y-2 lg:space-y-3 leading-normal self-center [&amp;_*]:text-left text-left"
          >
            <p class="mx-auto decoration-primary/6 w_full max-w-[unset]">no</p>
          </div>
        </div>
        <div
          role="cell"
          class="table_cell__X_gFM"
          style="
            width: clamp(100px, 100% - 395px, 100%);
            min-width: clamp(100px, 100% - 395px, 100%);
          "
        >
          <div
            class="blocks w_full space-y-2 lg:space-y-3 leading-normal self-center [&amp;_*]:text-left text-left"
          >
            <p class="mx-auto decoration-primary/6 w_full max-w-[unset]">
              additional external invoice id
            </p>
          </div>
        </div>
      </div>
      <div class="table_row__LpfCG" role="row">
        <div
          role="cell"
          class="table_cell__X_gFM"
          style="width: 181px; min-width: 181px"
        >
          <div
            class="blocks w_full space-y-2 lg:space-y-3 leading-normal self-center [&amp;_*]:text-left text-left"
          >
            <p class="mx-auto decoration-primary/6 w_full max-w-[unset]">
              email
            </p>
          </div>
        </div>
        <div
          role="cell"
          class="table_cell__X_gFM"
          style="width: 110px; min-width: 110px"
        >
          <div
            class="blocks w_full space-y-2 lg:space-y-3 leading-normal self-center [&amp;_*]:text-left text-left"
          >
            <p class="mx-auto decoration-primary/6 w_full max-w-[unset]">
              string
            </p>
          </div>
        </div>
        <div
          role="cell"
          class="table_cell__X_gFM"
          style="width: 104px; min-width: 104px"
        >
          <div
            class="blocks w_full space-y-2 lg:space-y-3 leading-normal self-center [&amp;_*]:text-left text-left"
          >
            <p class="mx-auto decoration-primary/6 w_full max-w-[unset]">no</p>
          </div>
        </div>
        <div
          role="cell"
          class="table_cell__X_gFM"
          style="
            width: clamp(100px, 100% - 395px, 100%);
            min-width: clamp(100px, 100% - 395px, 100%);
          "
        >
          <div
            class="blocks w_full space-y-2 lg:space-y-3 leading-normal self-center [&amp;_*]:text-left text-left"
          >
            <p class="mx-auto decoration-primary/6 w_full max-w-[unset]">
              end users email
            </p>
          </div>
        </div>
      </div>
      <div class="table_row__LpfCG" role="row">
        <div
          role="cell"
          class="table_cell__X_gFM"
          style="width: 181px; min-width: 181px"
        >
          <div
            class="blocks w_full space-y-2 lg:space-y-3 leading-normal self-center [&amp;_*]:text-left text-left"
          >
            <p class="mx-auto decoration-primary/6 w_full max-w-[unset]">
              description
            </p>
          </div>
        </div>
        <div
          role="cell"
          class="table_cell__X_gFM"
          style="width: 110px; min-width: 110px"
        >
          <div
            class="blocks w_full space-y-2 lg:space-y-3 leading-normal self-center [&amp;_*]:text-left text-left"
          >
            <p class="mx-auto decoration-primary/6 w_full max-w-[unset]">
              string
            </p>
          </div>
        </div>
        <div
          role="cell"
          class="table_cell__X_gFM"
          style="width: 104px; min-width: 104px"
        >
          <div
            class="blocks w_full space-y-2 lg:space-y-3 leading-normal self-center [&amp;_*]:text-left text-left"
          >
            <p class="mx-auto decoration-primary/6 w_full max-w-[unset]">no</p>
          </div>
        </div>
        <div
          role="cell"
          class="table_cell__X_gFM"
          style="
            width: clamp(100px, 100% - 395px, 100%);
            min-width: clamp(100px, 100% - 395px, 100%);
          "
        >
          <div
            class="blocks w_full space-y-2 lg:space-y-3 leading-normal self-center [&amp;_*]:text-left text-left"
          >
            <p class="mx-auto decoration-primary/6 w_full max-w-[unset]">
              order description
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
`;

    const md = convertHtmlToMarkdown(html);
    // Should contain a Markdown table header
    expect(md).toMatch(
      /\|\s*Attribute\s*\|\s*Type\s*\|\s*Required\s*\|\s*Description\s*\|/
    );
    // Should contain the separator row
    expect(md).toMatch(/\|\s*-+\s*\|\s*-+\s*\|\s*-+\s*\|\s*-+\s*\|/);
    // Should contain all data rows
    // Accept any number of backslashes before underscores (Turndown may escape as \\_)
    expect(md).toMatch(
      /\|\s*amount\s*\|\s*decimal\s*\|\s*yes\s*\|\s*order amount\s*\|/
    );
    expect(md).toMatch(
      /\|\s*currency(?:\\*)_id\s*\|\s*string\s*\|\s*yes\s*\|\s*order currency id\s*\|/
    );
    expect(md).toMatch(
      /\|\s*network\s*\|\s*string\s*\|\s*yes\s*\|\s*currency network\s*\|/
    );
    expect(md).toMatch(
      /\|\s*external(?:\\*)_order(?:\\*)_id\s*\|\s*string\s*\|\s*no\s*\|\s*additional external invoice id\s*\|/
    );
    expect(md).toMatch(
      /\|\s*email\s*\|\s*string\s*\|\s*no\s*\|\s*end users email\s*\|/
    );
    expect(md).toMatch(
      /\|\s*description\s*\|\s*string\s*\|\s*no\s*\|\s*order description\s*\|/
    );
  });
});
