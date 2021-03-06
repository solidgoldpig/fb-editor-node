# fb-editor-node

Form Builder Editor

## Pre-requisites

  [Node](https://nodejs.org)

## Installing

```
git clone git@github.com:ministryofjustice/fb-editor-node.git
cd fb-editor-node
npm install
```

## Usage

Set the `SERVICE_PATH` environment variable to point the path of form data on your filesystem.

```sh
SERVICE_PATH=/path/to/form npm start
```

An example form can be checked out from `https://github.com/ministryofjustice/fb-example-service`

By default, Form Builder Editor will use port 3000. If you want to run on a different port, set the `PORT` environment variable.

```sh
PORT=4321 SERVICE_PATH=/path/to/form npm start
```

If you are not developing editor features, consider using the [Form Builder Editor Console](https://github.com/ministryofjustice/fb-editor-console-electron) instead.


## Testing

```
npm test
```

Run unit tests only

```
npm run test:unit
```

Run linting only
```
npm run lint
```
