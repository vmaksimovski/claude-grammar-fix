# grammar-fix

A Claude Code mod that cleans up the message you type before it reaches Claude. It fixes spelling, grammar, punctuation and capitalization, and turns casual writing ("thx", "u", "idk", "gonna") into clear, standard English.

Only the text you typed is edited. These parts reach Claude exactly as written:

- pasted text
- code blocks and inline `code`
- URLs

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install grammar-fix --marketplace vmaksimovski/claude-grammar-fix
```

Answer `y` to add the marketplace, then pick a scope.

From a shell:

```
claude plugin install grammar-fix --marketplace vmaksimovski/claude-grammar-fix
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `vmaksimovski/claude-grammar-fix`, then Add plugin.

## How it works

- Each message you send gets a separate Haiku call that only sees that message. It has no tools and no conversation history.
- Protected parts are swapped for placeholders before the call and put back afterwards, byte for byte.
- If the call fails, times out (10s) or returns something that doesn't look like a correction, your original message is sent unchanged.
- It only touches messages you type. Slash commands, background notifications, other plugins' messages and `claude -p` runs are left alone.
- When it changes something, a "Message cleaned up" toast appears and your message on screen shows the corrected text.

## Limits

- Every message waits on one Haiku call first, so there's a small delay and cost per message.
- Typos that are still real words ("car" for "cat") aren't caught.
- Claude Code doesn't say directly whether text was pasted. Any single paste of 8+ characters or more than one line is protected; a shorter paste may get corrected.
- It uses Claude Code's mod API, which is early access and may change between releases.
