---
name: ensv2-writes
description: Find official ENSv2 docs for writing on-chain, such as registering subnames, deploying a UserRegistry through the Verifiable Factory, setSubregistry, role bitmaps (ROLE_CAN_TRANSFER_ADMIN, ROLE_REGISTRAR, ROLE_UNREGISTER), grantSetterRoles and the permissioned resolver. Use for Resona's pass issuing, transfers and revocation. The ensskills skills only cover reading ENS data.
---

# ENSv2 writes

The full ENS docs are saved at `.claude/references/ens-docs-llms-full.txt`, copied from https://docs.ens.domains/llms-full.txt on 2026-11-06.

The file is 1.8 MB, so never read it whole. Use `grep -n` for a term, then read only the lines around each match. Refresh it with `curl` if it might be out of date.

Resona's design is in `docs/ARCHITECTURE.md`, under "ENSv2: tickets as subnames".
