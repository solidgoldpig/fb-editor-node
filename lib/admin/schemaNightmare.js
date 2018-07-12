const Ajv = require('ajv')
const ajv = new Ajv({allErrors: true})

const condition = require('../instance/condition.schema.json')
const pagestart = require('../instance/page.start.schema.json')

ajv.addSchema(condition, 'condition')
ajv.addSchema(pagestart, 'page.start')

let sourceInstance = {
  _id: 'pageStartExample',
  _type: 'page.start',
  url: '/',
  heading: 'Create a hello world message',
  body: 'You can create a greeting for your favourite planet.\n\nIf you’re in a hurry or don’t have a favourite planet, you can ask for a basic hello world message.',
  steps: [
    'pageGreeting',
    'pagePlanet',
    'pageAccounts',
    'pageConfirmation'
  ]
}
delete sourceInstance._id

console.log(sourceInstance._type, sourceInstance)
const valid = ajv.validate(sourceInstance._type, JSON.stringify(sourceInstance, null, 2))
console.log(valid)
if (!valid) {
  console.log(ajv.errors)
}
