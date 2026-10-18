import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { mask, unmask } from '../hooks/mask'

const USAGE = {
  input_tokens: 0,
  output_tokens: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
}

// Stands in for the model: `fix` gets the masked message and returns the
// corrected one. Records what the model was sent.
const fakeModel = (on: On, fix: (message: string) => string) => {
  const sent: string[] = []
  on('model.complete', ($, e) => {
    sent.push(e.prompt)
    const message = /<message>([\s\S]*)<\/message>/.exec(e.prompt)?.[1] ?? ''
    return { value: { isAnswered: true, text: `<corrected>${fix(message)}</corrected>`, usage: USAGE } }
  })
  return sent
}

// The bottom of the chain: records the text that would reach the session.
const captureSubmit = (on: On) => {
  const entered: string[] = []
  on('prompt.submit', ($, e) => {
    entered.push(e.text)
    return { text: e.text }
  })
  return entered
}

const submit = ($: Engine, text: string) =>
  $.prompt.submit({ text, origin: { kind: 'composer' }, wait: false })

// The editor beneath: applies the splice as the engine would.
const editor = (on: On) =>
  on('prompt.edit', ($, e) => {
    const text = e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end)
    return { text, cursor: e.start + e.inputText.length }
  })

const paste = ($: Engine, inputText: string) =>
  $.prompt.edit({ origin: { kind: 'composer' }, text: '', cursor: 0, start: 0, end: 0, inputText })

describe('masking', () => {
  test('protects marked pastes, code and URLs, and restores them', async () => {
    const text =
      'pls fix `foo_bar` see https://x.io/a?b=1\n<pasted_content id="1">\nteh log\n</pasted_content id="1">\nthx'
    const { masked, protectedParts } = mask(text, [])

    expect(masked).toBe('pls fix ⟦0⟧ see ⟦1⟧\n⟦2⟧\nthx')
    expect(unmask(masked, protectedParts)).toBe(text)
  })

  test('refuses a reply that lost or reordered a placeholder', async () => {
    expect(unmask('a ⟦1⟧ b ⟦0⟧', ['x', 'y'])).toBeUndefined()
    expect(unmask('a b', ['x'])).toBeUndefined()
  })
})

describe('prompt.submit', () => {
  test('corrects typed text', async ($, on) => {
    const entered = captureSubmit(on)
    fakeModel(on, m => m.replace('sholud', 'should'))

    await submit($, 'This sholud work')

    expect(entered).toEqual(['This should work'])
  })

  test('leaves pasted text alone even if the model edits it', async ($, on) => {
    const entered = captureSubmit(on)
    const sent = fakeModel(on, m => m.replaceAll('teh', 'the'))
    editor(on)

    await paste($, 'error: teh widget failed\n  at main.ts:4')
    await submit($, 'look at teh error:\nerror: teh widget failed\n  at main.ts:4')

    expect(sent[0]).not.toContain('widget')
    expect(entered).toEqual(['look at the error:\n' + 'error: teh widget failed\n  at main.ts:4'])
  })

  test('passes the original through when the model answers instead', async ($, on) => {
    const entered = captureSubmit(on)
    fakeModel(on, () => 'Sure! Here is a long helpful answer to your question about the build system.')

    await submit($, 'why build broke')

    expect(entered).toEqual(['why build broke'])
  })

  test('skips prompts the person did not type', async ($, on) => {
    const entered = captureSubmit(on)
    const sent = fakeModel(on, m => m.toUpperCase())

    await $.prompt.submit({ text: 'teh notice', origin: { kind: 'task-notification' }, wait: false })

    expect(sent).toEqual([])
    expect(entered).toEqual(['teh notice'])
  })
})
