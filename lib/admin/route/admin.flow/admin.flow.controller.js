const jp = require('jsonpath')
const {default: produce} = require('immer')

const {
  getServiceInstances,
  createInstance,
  getInstanceTitle,
  getInstance,
  getSourceInstance,
  getSourceInstanceProperty,
  setInstanceProperty,
  loadServiceData
} = require('../../../service-data/service-data')

const flowController = {}

flowController.setData = (pageInstance, pageData) => {
  const _id = pageData.getUserDataProperty('_id') || 'pageStartExample'
  const flowPageInstance = produce(pageInstance, draft => {
    const getFlowStep = (_id) => {
      let flowStep = getInstance(_id)
      flowStep = produce(flowStep, flowDraft => {
        flowDraft.title = getInstanceTitle(_id)
        if (flowDraft.steps) {
          flowDraft.flowsteps = flowDraft.steps.map(getFlowStep)
        }
      })
      return flowStep
    }
    draft.flowstep = getFlowStep(_id)
    return draft
  })
  // console.log(flowPageInstance.flowstep)
  // const addId = pageData.getUserDataProperty('addId') || ''
  // const _type = pageData.getUserDataProperty('_type') || ''
  // const pagePrefix = _type.startsWith('page.') ? 'page.' : ''
  // const idPrefix = pagePrefix || (addId ? `${addId}--` : '')
  // // if page && addId, then we're putting in steps
  // // we could then have a positional arg too
  // const _id = pageData.getUserDataProperty('_id') || `${idPrefix}randoString`
  // pageData.setUserDataProperty('_id', _id)

  return flowPageInstance
}

module.exports = flowController
