const {default: produce} = require('immer')
const deepEqual = require('deep-equal')
const {deepClone} = require('@ministryofjustice/fb-utils-node')

const {
  getEntryPointInstances,
  getInstanceTitle,
  getInstance
} = require('../../../service-data/service-data')

const {getPagesMethods} = require('@ministryofjustice/fb-runner-node/lib/middleware/routes-metadata/routes-metadata')

const {
  kludgeUpdates,
  formatProperties
} = require('@ministryofjustice/fb-runner-node/lib/page/page')

const flowController = {}

const isSameCondition = (a, b) => {
  if (a === undefined || b === undefined) {
    return false
  }
  const [aShow, bShow] = [a.show, b.show]
  if (aShow === undefined || bShow === undefined) {
    return false
  }
  if (aShow === true || bShow === true) {
    return false
  }
  return deepEqual(aShow, bShow)
}
const isAlternativeCondition = (a, b) => {
  if (a === undefined || b === undefined) {
    return false
  }
  const [aShow, bShow] = [a.show, b.show]
  if (aShow === undefined || bShow === undefined) {
    return false
  }
  if (aShow === true || bShow === true) {
    return false
  }
  if (deepEqual(aShow, bShow)) {
    return false
  }
  if (aShow.identifier === bShow.identifier) {
    return true
  }
}

flowController.setData = (pageInstance, pageData) => {
  const {nunjucks} = pageData
  const renderPage = (pageInstance) => {
    const templatePath = `${pageInstance._type.replace(/\./g, '/')}/template/nunjucks/${pageInstance._type}.njk.html`
    const context = {
      page: deepClone(pageInstance)
    }
    return nunjucks.render(templatePath, context)
  }

  const metadataMethods = getPagesMethods()
  const _id = pageData.getUserDataProperty('_id')
  const topId = _id
  const _ids = _id ? [_id] : getEntryPointInstances().sort((a, b) => a.url > b.url ? 1 : -1).map(instance => instance._id)

  const flowPageInstance = produce(pageInstance, draft => {
    const getFlowStep = (_id, start) => {
      let flowStep = getInstance(_id)
      flowStep = produce(flowStep, flowDraft => {
        if (start) {
          flowDraft.$flowStart = true
          if (topId === _id) {
            flowDraft.$flowSelf = true
          }
        }
        let renderInstance = formatProperties(flowDraft, pageData)
        renderInstance = kludgeUpdates(renderInstance, pageData)
        let rendered = renderPage(renderInstance)
        rendered = rendered.replace(/[\s\S]*?<header/, '<header')
          .replace(/<\/footer>[\s\S]*/, '</footer>')
        flowDraft.rendered = rendered
        flowDraft.title = getInstanceTitle(_id)
        flowDraft.url = flowDraft.url.replace(/\{[^}]+\}/g, '1')
        if (flowDraft.steps) {
          flowDraft.flowsteps = flowDraft.steps.map(stepId => getFlowStep(stepId))
          flowDraft.flowsteps.forEach((draftStep, index, arr) => {
            if (draftStep.show && typeof draftStep.show === 'object') {
              const nextStep = arr[index + 1]
              const previousStep = arr[index - 1]
              const nextSame = isSameCondition(draftStep, nextStep)
              const previousSame = isSameCondition(draftStep, previousStep)
              const nextAlternative = isAlternativeCondition(draftStep, nextStep)
              const previousAlternative = isAlternativeCondition(draftStep, previousStep)

              arr[index] = produce(draftStep, drafty => {
                if (nextAlternative || previousAlternative) {
                  drafty.$stepOption = true
                  if (!nextAlternative) {
                    drafty.$stepOptionLast = true
                  }
                  if (!previousAlternative) {
                    drafty.$stepOptionFirst = true
                  }
                }
                if (nextSame || previousSame) {
                  drafty.$stepSkip = true
                  if (!nextSame) {
                    drafty.$stepSkipLast = true
                  }
                  if (!previousSame) {
                    drafty.$stepSkipFirst = true
                  }
                }
                if (nextStep && !nextAlternative && !previousAlternative && !nextSame && !previousSame) {
                  drafty.$stepSkip = true
                  drafty.$stepSkipLast = true
                  drafty.$stepSkipFirst = true
                }
              })
            }
          })
        }
      })
      return flowStep
    }
    draft.flowsteps = _ids.map(_id => getFlowStep(_id, true))
    return draft
  })

  return flowPageInstance
}

module.exports = flowController
