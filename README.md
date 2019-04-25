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

```
cd fb-editor-node
SERVICE_PATH=/path/to/form npm start npm start
```

`SERVICE_PATH` is the location of your form data

eg.

`https://github.com/ministryofjustice/fb-example-service`


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
