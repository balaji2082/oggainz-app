# 08 — Working with Balaji

Practical things: how to branch, when to ask, what he needs from you and what he
will give back.

---

## He is a beginner coder, and he is the decision-maker

Both at once, and both matter.

He is 21, running OG Gainz single-handed — kitchen, deliveries, coaching, brand,
the lot — and learning to code alongside it. He will not always follow a
technical explanation on the first pass, and he has asked to be explained to
plainly.

**What that means in practice:** "additive migration" means nothing to him. "It
adds a way to ask for data and changes nothing about how the app works" means
everything. The explanation that landed best, when the customer API was being
added, was this one:

> The Command Center is the kitchen where all the food is. The new app is a new
> dining room. `customer_api.py` is a serving hatch cut in the kitchen wall so
> plates can reach the table.

That is the register to aim for. It is not talking down — it is the difference
between him being able to decide and him having to trust you blindly.

And he **is** the decision-maker. It is his business, his money and his
customers. He also pushes back directly when something seems wrong, and he is
usually right about the business even when he is unsure about the code. If he
disagrees with a technical call, say your reasoning plainly once and then let him
decide.

## He works from his phone

His laptop is failing, so he works from a Galaxy Z Fold and cloud sessions. Keep
that in mind:

- Short messages beat long ones
- A screenshot beats a stack trace
- A link he can tap beats "check the repo"
- He may not be able to run your branch locally — tell him what changed and what
  it looks like

## When he is around

Evenings, India time. Roughly 20:45–21:45 for coding and 22:00–23:00 for business
admin. Mornings are cardio, kitchen and deliveries; he is not available then.

Batch your questions rather than drip-feeding them — one message with four
questions is far more useful to him than four messages.

---

## The branch workflow

```bash
# always start from an up-to-date main
git checkout main
git pull origin main

# your own branch, named for the work
git checkout -b abishek/landing-page-polish

# ... build ...

npm run build      # MUST pass before you ask for a review
npm run lint

git add -A
git commit -m "Landing page: real hero, the three packs, and a way to get in touch"
git push -u origin abishek/landing-page-polish
```

Then tell Balaji: the branch name, what it changes, and — since he is on a phone
— **a screenshot** if it is visual.

**He merges. He deploys. Not you.** See [05](05-RULES.md).

### Branch naming

`abishek/<what-it-does>`. Never push to `main`.

### Commit messages

Look at the history in both repos before writing your first one — the convention
is a plain sentence saying what changed and, where it matters, **why**. For
example:

> *Don't offer a pause the kitchen is going to refuse*
> *A wrong link must not be permanent, and a used link must not be a dead end*
> *Approve by recognising the person, not by looking up an id*

Not `fix bug` or `update files`. Write the one a person would want to read in six
months when something has gone wrong — because that is exactly when it gets read.
If the change came from a real failure, say what the failure was.

---

## How to ask a good question here

Four lines:

1. **What you are trying to do**
2. **What you tried**
3. **What happened instead** — the actual error, pasted
4. **What you think is going on**

And if it involves the Command Center, data, money or meal counts, add: **"this
needs a change on the Command Center side"** right at the top. Do not bury it in
paragraph three. That exact mistake is why one of the rules in
[05](05-RULES.md) exists — a Command Center change was mentioned in one passing
line, Balaji did not read it as a warning, and he had to ask afterwards "did you
change it or what?"

Lead with it. He does not refuse these changes when they are explained.

---

## What to do when you are blocked

| Blocked on | Do |
|---|---|
| Missing secrets | Ask Balaji directly. Never over anything public. |
| GitHub access | Balaji adds you as a collaborator. |
| A Command Center change | Write it up, give it to him, carry on with something else. |
| A business rule you cannot find | Search `docs/01`–`docs/04` for `[LAW]` and `[RULE]`. Then ask. |
| Data looks wrong | `curl https://app.oggainz.com/api/health` **first**. |
| Something that needs money spending | Ask. Free tiers only — about ₹0/month, and that is a business constraint. |

**Never block on a deploy.** If something only works in production, it waits for
Balaji.

---

## What he needs from you, in one line each

1. **Tell him before you touch anything that is live, not after.**
2. **Plain language, not jargon.** He will decide well if he understands.
3. **Say when you are unsure.** A flagged guess is useful; a confident wrong
   answer costs real meals.
4. **Write down what you work out.** Half of this pack exists because somebody
   did, and the other half exists because somebody did not.
