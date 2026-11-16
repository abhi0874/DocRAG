import {describe, expect, it} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {MessageContent} from '@/components/message-content'
const render = (text: string) => renderToStaticMarkup(<MessageContent text={text} sourceCount={2} onCitationClick={() => {}}/>)
describe('safe answer presentation', () => {
  it('retains exact valid source numbers across headings and lists', () => {
    const html = render('# Transactions\n- Use **BEGIN** [2].\n- Then COMMIT [1].')
    expect(html).toContain('<h3>Transactions</h3>')
    expect(html).toContain('<strong>BEGIN</strong>')
    expect(html.match(/aria-label="Show source/g)).toHaveLength(2)
    expect(html.indexOf('Show source 2')).toBeLessThan(html.indexOf('Show source 1'))
  })
  it('keeps fenced, inline, link and invalid source examples inert', () => {
    const html = render('```sql\nSELECT arr[1];\n```\nUse `array[2]`. [1](https://example.org) [3] [-1]')
    expect(html).toContain('<pre')
    expect(html).not.toContain('Show source')
    expect(html).not.toContain('href=')
  })
  it('escapes hostile HTML and never creates remote images', () => {
    const html = render('<script>alert(1)</script> ![x](https://example.org/image)')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;script&gt;')
  })
  it('renders unfinished streaming code without activating examples', () => {
    const html = render('```\n[1] still streaming')
    expect(html).toContain('<pre')
    expect(html).not.toContain('Show source')
  })
  it('retains explicitly attributed valid inline references', () => {
    expect(render('According to source `[1]`')).toContain('Show source 1')
  })
})
