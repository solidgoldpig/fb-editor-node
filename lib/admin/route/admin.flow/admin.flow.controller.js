const jp = require('jsonpath')
const {default: produce} = require('immer')
const deepEqual = require('deep-equal')
const {deepClone} = require('@ministryofjustice/fb-utils-node')

const {
  getInstanceTitle,
  getInstance
} = require('../../../service-data/service-data')

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

  const _id = pageData.getUserDataProperty('_id') || 'pageStartExample'
  const flowPageInstance = produce(pageInstance, draft => {
    const getFlowStep = (_id) => {
      let flowStep = getInstance(_id)
      flowStep = produce(flowStep, flowDraft => {
        let renderInstance = formatProperties(flowDraft, pageData)
        renderInstance = kludgeUpdates(renderInstance, pageData)
        let rendered = renderPage(renderInstance)
        rendered = rendered.replace(/[\s\S]*?<header/, '<header')
          .replace(/<\/footer>[\s\S]*/, '</footer>')
        flowDraft.rendered = rendered
        flowDraft.title = getInstanceTitle(_id)
        if (flowDraft.steps) {
          flowDraft.flowsteps = flowDraft.steps.map(getFlowStep)
          flowDraft.flowsteps.forEach((draftStep, index, arr) => {
            if (draftStep.show && typeof draftStep.show === 'object') {
              // const previousStep = arr[index - 1]
              const nextStep = arr[index + 1]
              const previousStep = arr[index - 1]
              const nextSame = isSameCondition(draftStep, nextStep)
              const previousSame = isSameCondition(draftStep, previousStep)
              const nextAlternative = isAlternativeCondition(draftStep, nextStep)
              const previousAlternative = isAlternativeCondition(draftStep, previousStep)

              arr[index] = produce(draftStep, drafty => {
                if (nextAlternative || previousAlternative) {
                  drafty.$stepOption = true
                  // classes += ' fb-step-option'
                  if (!nextAlternative) {
                    drafty.$stepOptionLast = true
                    // classes += ' fb-step-option-last'
                  }
                  if (!previousAlternative) {
                    drafty.$stepOptionFirst = true
                    // classes += ' fb-step-option-first'
                  }
                }
                if (nextSame || previousSame) {
                  drafty.$stepSkip = true
                  // classes += ' fb-step-skip'
                  if (!nextSame) {
                    drafty.$stepSkipLast = true
                    // classes += ' fb-step-skip-last'
                  }
                  if (!previousSame) {
                    drafty.$stepSkipFirst = true
                    // classes += ' fb-step-skip-first'
                  }
                }
              // if (nextSame && !previousSame) {
              //   classes = 'fb-step-skip fb-step-skip-first'
              // } else if (!nextSame && previousSame) {
              //   classes = 'fb-step-skip'
              // } else if (nextSame && previousSame) {
              //   classes = 'fb-step-skip'
              // } else if (isAlternativeCondition(draftStep, nextStep)) {
              //   classes = 'fb-step-option'
              // } else if (isAlternativeCondition(draftStep, previousStep)) {
              //   classes = 'fb-step-option'
              // }
              })
            }
          })
        }
        // if (flowDraft.show) {
        //   console.log(flowDraft.show)
        //   flowDraft.classes = 'fb-step-skip'
        // }
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
