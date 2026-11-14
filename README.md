# SCMS Backend

REST API for a scratch card management system. Dealers ask for card activations, several approval levels review them, and the cards become active once the last level approves.

## Features

- **Authentication**
  - Login with username and password, answered with a token (valid for 1 hour)
  - First login and expired password flows, and password reset
- **Users, profiles and menus**
  - Users with a profile (admin, warehouse, accounting, billing)
  - Menu access by profile
- **Dealers and denominations**
  - Create, list, update, enable or disable, delete
- **Activations**
  - Create an activation for a dealer
  - Approval workflow with strict rules: levels in order, a reason for each rejection, rejected activations can be sent again, full history
  - List the activations waiting for a given profile
- **Card details**
  - Card ranges (batch, start and end serial number, number of cards and pins) attached to an activation
  - The cards are activated by the final approval of their activation
- **Comments and mail receivers**

## Tech stack

- Node.js
- Express
- Sequelize and sequelize-cli
- PostgreSQL
- JSON Web Tokens (`jsonwebtoken`, `njwt`) and `bcrypt` for passwords
- Joi, for request validation
- dotenv, for environment variables

## Requirements

- Node.js 18 or newer
- PostgreSQL, running on your machine, with a user that is allowed to create databases

## Setup

```
npm install
cp .env.example .env        # then edit .env with your own values
npm run db:setup            # creates the database, runs the migrations, loads the seed data
npm run create-admin -- <username> "<full name>" <email>   # first admin, see below
npm start
```

Only an admin can create users through the API, so a new database needs one admin created from the command line. `create-admin` gives it the `defaultPassword`; it must be changed at the first login.

The API does not start when `jwtPrivateKey` is missing.

The API answers on `http://localhost:8000/api/v1/` (or the `PORT` you set).

### Environment variables

Set these in `.env`:

| Name              | Meaning                                            | Example                      |
| ----------------- | -------------------------------------------------- | ---------------------------- |
| `PORT`            | Port of the API                                    | `8000`                       |
| `DB_USERNAME`     | PostgreSQL user                                    | `postgres`                   |
| `DB_PASSWORD`     | PostgreSQL password                                | `change_me`                  |
| `DB_NAME`         | Database name                                      | `scms`                       |
| `DB_NAME_TEST`    | Database used by the tests                         | `scms_test`                  |
| `DB_HOST`         | Database host                                      | `127.0.0.1`                  |
| `DB_PORT`         | Database port                                      | `5432`                       |
| `jwtPrivateKey`   | Secret used to sign tokens. Use a long random text | `change_me_long_random_text` |
| `defaultPassword` | First password given to a new user                 | `change_me_first_password`   |

`.env` is private and is not committed. `.env.example` is the template without real values.

## Scripts

| Command                    | What it does                                       |
| -------------------------- | -------------------------------------------------- |
| `npm start`                | Starts the API                                     |
| `npm run dev`              | Starts the API and restarts it when a file changes |
| `npm run create-admin`     | Creates an admin user (see Setup)                  |
| `npm run db:create`        | Creates the database                               |
| `npm run migrate`          | Creates or updates the tables                      |
| `npm run seed`             | Loads the starting data (profiles, menus, access)  |
| `npm run db:setup`         | The three steps above, in order                    |
| `npm run seed:undo`        | Removes the seed data                              |
| `npm run migrate:undo`     | Undoes the last migration                          |
| `npm run migrate:undo:all` | Undoes all migrations (the tables are dropped)     |
| `npm run db:drop`          | Deletes the database                               |
| `npm run db:reset`         | Drops the database and builds it again             |
| `npm test`                 | Runs the tests                                     |

To work on the test database, put `NODE_ENV=test` in front of a command, for example `NODE_ENV=test npm run db:setup`.

## Authentication

Log in with `POST /api/v1/auth`. Send the token you get back in the header of every other request:

```
x-auth-token: <token>
```

The account is checked on every request: when a user is disabled or deleted, their token stops working at once (401), and a profile change applies at once.

Login answers with a `status` number: `1` login worked (the `statusMessage` holds the token), `2` first login (the password must be changed), `3` password expired (also when the user has no expiry date), `0` wrong username or password (HTTP 401) or disabled account (HTTP 403).

With status `2` or `3` there is no token. The answer holds the `userId`; change the password with `PUT /api/v1/auth/:userId` (no token needed) and this body:

```json
{
  "oldpassword": "current password",
  "newpassword": "new password, 5 characters or more, different from the old one",
  "confirmpassword": "same as newpassword"
}
```

A successful change ends the first login state and makes the password valid for 30 days. `resetType` may still be sent but is no longer used. A wrong `oldpassword` answers 401, a disabled account 403, a missing or mismatching field 400.

## Errors

Errors never stop the server. Invalid input (for example a text where a numeric id is expected) answers `400 Invalid input`, a duplicate record `409`, anything unexpected `500 Internal server error`; the details are written to the server log only.

## Endpoints

All paths start with `/api/v1`. "Token" means the `x-auth-token` header is required; "admin" means the token must belong to a user with the admin profile. User data never includes the password hash.

### Authentication and users

| Method | Path                         | Token | What it does                                                         |
| ------ | ---------------------------- | ----- | -------------------------------------------------------------------- |
| POST   | `/auth`                      | no    | Log in                                                               |
| PUT    | `/auth/:userId`              | no    | Change the password (needs the current password, see above)         |
| GET    | `/user`                      | yes   | List users                                                           |
| GET    | `/user/:userId`              | yes   | Get a user                                                           |
| POST   | `/user`                      | admin | Create a user (the first password is `defaultPassword`)              |
| PUT    | `/user/:userId`              | yes   | Update a user. Non-admins: only their own account, profile unchanged |
| PUT    | `/user/updatestatus/:userId` | admin | Enable or disable a user (`status`: true or false), not yourself     |
| DELETE | `/user/:userId`              | admin | Delete a user, not yourself                                          |

### Profiles and menu access

| Method           | Path                                          | Token | What it does                    |
| ---------------- | --------------------------------------------- | ----- | ------------------------------- |
| GET, POST        | `/profiles`                                   | yes   | List, create                    |
| GET, PUT, DELETE | `/profiles/:profileId`                        | yes   | Get, update, delete             |
| PUT              | `/profiles/updatestatus/:profileId`           | yes   | Enable or disable               |
| GET, POST        | `/accessmenu`                                 | yes   | List, create                    |
| GET, PUT, DELETE | `/accessmenu/:accessmenuId`                   | yes   | Get, update, delete             |
| GET              | `/accessmenu/listmenu/:profilelevelId`        | yes   | Menus of a profile level        |
| GET              | `/accessmenu/listdefaultmenu/:profilelevelId` | yes   | Default menu of a profile level |
| PUT              | `/accessmenu/updatestatus/:accessmenuId`      | yes   | Enable or disable               |

### Dealers, denominations and mail receivers

| Method           | Path                                          | Token | What it does        |
| ---------------- | --------------------------------------------- | ----- | ------------------- |
| GET, POST        | `/dealers`                                    | yes   | List, create        |
| GET, PUT, DELETE | `/dealers/:dealerId`                          | yes   | Get, update, delete |
| PUT              | `/dealers/updatestatus/:dealerId`             | yes   | Enable or disable   |
| GET, POST        | `/denomination`                               | yes   | List, create        |
| GET, PUT, DELETE | `/denomination/:denominationId`               | yes   | Get, update, delete |
| PUT              | `/denomination/updatestatus/:denominationId`  | yes   | Enable or disable   |
| GET, POST        | `/mailreceivers`                              | yes   | List, create        |
| GET, PUT, DELETE | `/mailreceivers/:mailreceiverId`              | yes   | Get, update, delete |
| PUT              | `/mailreceivers/updatestatus/:mailreceiverId` | yes   | Enable or disable   |

### Activations

| Method | Path                                     | Token | What it does                                                  |
| ------ | ---------------------------------------- | ----- | ------------------------------------------------------------- |
| POST   | `/activations`                           | yes   | Submit an activation (`dealer_id`); the submitter is you      |
| GET    | `/activations/activbyprofile/:profileId` | yes   | 3: waiting for level 2, 4: waiting for level 3, other: all    |
| GET    | `/activations/:activationId`             | yes   | Get one activation with its history (`events`)                |
| PUT    | `/activations/:activationId`             | yes   | Change the dealer (`dealer_id`) while the activation is open  |
| PUT    | `/activations/approve/:activationId`     | yes   | Approve at your level                                         |
| PUT    | `/activations/reject/:activationId`      | yes   | Reject at your level, `reason` required                       |
| PUT    | `/activations/resubmit/:activationId`    | yes   | Send a rejected activation again, optional `comment`          |
| DELETE | `/activations/:activationId`             | yes   | Delete an activation while it is open                         |

Activations have a `state` field: `pending_level2`, `pending_level3`, `approved` or `rejected`. See [Approval workflow](#approval-workflow).

### Card details

| Method | Path                                    | Token | What it does                           |
| ------ | --------------------------------------- | ----- | -------------------------------------- |
| GET    | `/carddetails`                          | yes   | List card ranges                       |
| POST   | `/carddetails`                          | yes   | Add a card range to an open activation |
| GET    | `/carddetails/:carddetailId`            | yes   | Get one range                          |
| PUT    | `/carddetails/:carddetailId`            | yes   | Update a range of an open activation   |
| DELETE | `/carddetails/:carddetailId`            | yes   | Delete a range of an open activation   |
| DELETE | `/carddetails/deletebyactivId/:activId` | yes   | Delete one range of an open activation |

"Open" means waiting for level 2 or rejected, and the change is made by the submitter or an admin.

### Comments

| Method           | Path                   | Token | What it does        |
| ---------------- | ---------------------- | ----- | ------------------- |
| GET, POST        | `/comments`            | yes   | List, create        |
| GET, PUT, DELETE | `/comments/:commentId` | yes   | Get, update, delete |

## Approval workflow

```
submit ──> pending_level2 ──approve (accounting)──> pending_level3 ──approve (billing)──> approved
                │                                       │                                (cards active)
                └──reject + reason──> rejected <──reject + reason──┘
                                         │
                     resubmit ───────────┘──> pending_level2
```

- **Levels go in order.** Level 2 is the accounting profile, level 3 the billing profile. The server finds the level from the user's profile; the request cannot choose it. A level can only decide on an activation waiting for it, and only once. Other profiles (admin, warehouse) cannot approve or reject.
- **No self-approval.** Nobody approves or rejects an activation they submitted.
- **No empty approval.** An activation without card details cannot be approved.
- **A rejection needs a reason** (`reason`, 5 to 1000 characters). The activation goes back to the submitter.
- **A rejected activation can be sent again** by its submitter or an admin, after changes if needed. It starts again at level 2.
- **Open activations only can change.** The dealer, the card ranges, and deletion are allowed only while the activation waits for level 2 or is rejected, and only for the submitter or an admin. Card ranges cannot move to another activation.
- **Final approval is one transaction.** The cards are activated and the activation is marked approved together, or nothing is saved.
- **One decision at a time.** Each step locks the activation row, so two people acting at the same moment cannot both succeed; the second one gets 409.
- **History.** Every step is stored in `ActivationEvents` (who, level, action, reason) and returned as `events` by `GET /activations/:activationId` and the list.

Answers: `403` for a profile or user not allowed, `409` when the activation is not in the right state (the message says which state it is in), `400` for a missing reason.

The old routes `PUT /activations/confirm/:activationId`, `PUT /activations/updatestatus/:activationId`, `PUT /carddetails/cardactivate/:carddetailId` and `PUT /carddetails/updatestatus/:actId` were removed: they changed approvals or activated cards without these rules.

## Project structure

```
app.js                  Express app
bin/run.js              Starts the server
bin/create-admin.js     Creates an admin user
server/
  config/               Database settings (read from .env)
  controllers/          Request handlers
  middleware/           Token check, profile check, error handler
  migrations/           Table definitions
  models/               Sequelize models and Joi rules
  routes/               URLs
  seeders/              Starting data
  services/             Token, password, activation number helpers and the
                        approval workflow (activationState, activationWorkflow)
  utils/catchAsync.js   Sends errors of async handlers to the error handler
tests/                  Vitest and Supertest tests
```

## Tests

```
NODE_ENV=test npm run db:setup     # once, to prepare the test database
npm test
```
