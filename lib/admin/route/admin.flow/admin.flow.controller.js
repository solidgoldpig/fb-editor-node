const jp = require('jsonpath')
const {default: produce} = require('immer')
const deepEqual = require('deep-equal')
const {deepClone} = require('@ministryofjustice/fb-utils-node')

const {propagateInstanceConditions} = require('@ministryofjustice/fb-runtime-node/lib/propagate-show')

const {
  getEntryPointInstances,
  getInstanceTitle,
  getInstance,
  getInstanceProperty,
  getSourceInstance
} = require('../../../service-data/service-data')

const {getPagesMethods} = require('@ministryofjustice/fb-runner-node/lib/middleware/routes-metadata/routes-metadata')
const controllers = require('@ministryofjustice/fb-runner-node/lib/page/controller/controller')

const {
  setControlNames,
  setRepeatable,
  setComposite,
  kludgeUpdates,
  formatProperties
} = require('@ministryofjustice/fb-runner-node/lib/page/page')

const flowController = {}

const getSourceStepWithShow = (step) => {
  if (!step) {
    return
  }
  let sourceStep = getSourceInstance(step._id)
  if (!sourceStep) {
    if (step.$autoInjected) {
      step = deepClone(step)
      delete step.show
      return step
    }
    return
  }
  const propgatedSteps = propagateInstanceConditions({
    [step._id]: sourceStep
  }, true)
  return propgatedSteps[step._id]
}

const isSameCondition = (a, b) => {
  if (a === undefined || b === undefined) {
    return false
  }
  if (b.$autoInjected) {
    // Should this return true?
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

        const controller = controllers[flowDraft._type] || {}
        let renderInstance = flowDraft
        if (controller.setContents) {
          renderInstance = controller.setContents(renderInstance, pageData)
        }

        renderInstance = setControlNames(renderInstance, pageData)
        renderInstance = setRepeatable(renderInstance, pageData, true)
        renderInstance = setComposite(renderInstance, pageData)
        renderInstance = formatProperties(renderInstance, pageData)
        renderInstance = kludgeUpdates(renderInstance, pageData)
        let rendered = renderPage(renderInstance)
        rendered = rendered.replace(/[\s\S]*?<header/, '<header')
          .replace(/<\/footer>[\s\S]*/, '</footer>')
        flowDraft.rendered = rendered
        flowDraft.title = getInstanceTitle(_id)
        flowDraft.url = flowDraft.url.replace(/\{[^}]+\}/g, '1')
          .replace(/\/:[^/]+/g, '/1')
        if (flowDraft.steps) {
          flowDraft.flowsteps = flowDraft.steps.map(stepId => getFlowStep(stepId))
          flowDraft.flowsteps.forEach((draftStep, index, arr) => {
            if (draftStep.show && typeof draftStep.show === 'object') {
              const parentStep = draftStep._parent ? getInstance(draftStep._parent) : undefined
              const nextStep = arr[index + 1]
              const previousStep = arr[index - 1]
              const draftStepSourceInstance = getSourceStepWithShow(draftStep)
              const nextStepSourceInstance = getSourceStepWithShow(nextStep)
              const previousStepSourceInstance = getSourceStepWithShow(previousStep)
              let nextSame = isSameCondition(draftStepSourceInstance, nextStepSourceInstance)
              let previousSame = isSameCondition(draftStepSourceInstance, previousStepSourceInstance)
              if (!index && !previousSame && parentStep) {
                // nextSame = true
                let parentNextSibling
                if (parentStep._parent) {
                  // let grandParent = getInstance(parentStep._parent)
                  // let grandParentSteps = getInstanceProperty(parentStep._parent, 'steps')
                  // let parentIndex = grandParentSteps.indexOf(parentStep._id)
                  // parentNextSibling = grandParentSteps[parentIndex + 1]
                  // console.log({draftStep, parentNextSibling})
                  // previousSame = isSameCondition(draftStep, parentStep)
                }
              }
              const nextAlternative = isAlternativeCondition(draftStepSourceInstance, nextStepSourceInstance)
              const previousAlternative = isAlternativeCondition(draftStepSourceInstance, previousStepSourceInstance)

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

                if (drafty.$stepSkipFirst || drafty.$stepOptionFirst) {
                  let show = deepClone(draftStepSourceInstance.show)
                  if (drafty.$stepOption && show.identifier) {
                    delete show.value
                  }
                  drafty.$showConditions = JSON.stringify(show, null, 2)
                }
                if (drafty.$stepSkipFirst) {
                  drafty.$showValues = ['yes', 'no']
                }
                if (drafty.$stepOption) {
                  let value = draftStepSourceInstance.show.value
                  value = value || 'Undetermined'
                  drafty.$showValues = [value]
                }
                // if (drafty._id === 'page.wantnomore') {
                //   delete drafty.$stepSkip
                //   delete drafty.$stepSkipLast
                //   delete drafty.$stepSkipFirst
                // }
                // if (drafty._id === 'page.wantnomore.summary') {
                //   drafty.$stepSkip = false
                //   drafty.$stepSkipLast = false
                // }
                // if (draftStep._id === 'page.wantno') {
                //   console.log('page.wantno', {nextAlternative, previousAlternative, nextSame, previousSame})
                //   console.log(draftStep.flowsteps)
                // }
                // if (draftStep._id === 'page.wantnomore') {
                //   console.log('page.wantnomore', {nextAlternative, previousAlternative, nextSame, previousSame})
                //   console.log(draftStep.flowsteps)
                // }
                // if (draftStep._id === 'page.wantnomore.summary') {
                //   console.log('page.wantnomore.summary', {nextAlternative, previousAlternative, nextSame, previousSame})
                //   console.log(draftStep.flowsteps)
                // }
              })
            }
          })
        }
        const flowDraftSource = getSourceStepWithShow(flowDraft)
        flowDraft.show = flowDraftSource ? flowDraftSource.show : undefined
        if (flowDraft.show && flowDraft.show !== true) {
          if (flowDraft.$stepSkipFirst || flowDraft.$stepOptionFirst) {
            // flowDraft.$showConditions = flowDraft.show
          }
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
