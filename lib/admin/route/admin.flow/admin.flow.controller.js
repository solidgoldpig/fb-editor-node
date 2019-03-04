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
  getInstanceIdByPropertyValue,
  getSourceInstance
} = require('../../../service-data/service-data')

const {
  getEvaluationOperators
} = require('@ministryofjustice/fb-runner-node/lib/evaluate-condition/evaluate-condition')
const {getPagesMethods} = require('@ministryofjustice/fb-runner-node/lib/route/route')
const controllers = require('@ministryofjustice/fb-runner-node/lib/page/controller/controller')
const evaluationOperators = getEvaluationOperators()

const {
  setControlNames,
  setRepeatable,
  setComposite,
  kludgeUpdates,
  formatProperties,
  setService
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

const getAlternativeCondition = (aShow, bShow) => {
  if (aShow === undefined || bShow === undefined) {
    return
  }
  if (aShow === true || bShow === true) {
    return
  }
  if (deepEqual(aShow, bShow)) {
    return
  }
  if (aShow.identifier) {
    if (aShow.identifier === bShow.identifier && aShow.operator === bShow.operator) {
      const showCondition = deepClone(aShow)
      // showCondition.value = '<VALUE>'
      return showCondition
    }
  }
  let aShowAll = aShow.all
  let bShowAll = bShow.all
  if (aShowAll && bShowAll) {
    if (aShowAll.length === bShowAll.length) {
      let allParts = []
      aShowAll.forEach((val, index) => {
        allParts.push(getAlternativeCondition(val, bShowAll[index]))
      })
      allParts = allParts.filter(condition => condition)
      if (allParts.length === 1) {
        return allParts[0]
      }
    }
  }
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
  return getAlternativeCondition(aShow, bShow)
  // if (aShow === true || bShow === true) {
  //   return false
  // }
  // if (deepEqual(aShow, bShow)) {
  //   return false
  // }
  // if (aShow.identifier) {
  //   if (aShow.identifier === bShow.identifier) {
  //     return true
  //   }
  // }
}

flowController.setData = (pageInstance, pageData) => {
  const {nunjucks} = pageData
  const renderPage = (pageInstance) => {
    const templatePath = `${pageInstance._type.replace(/\./g, '/')}/template/nunjucks/${pageInstance._type}.njk.html`
    const page = deepClone(pageInstance)
    // page.flow = true
    page.EDITMODE = 'flow'
    page.MODE = 'flow'
    const context = {
      page
    }
    return nunjucks.render(templatePath, context)
  }

  const metadataMethods = getPagesMethods()
  const _id = pageData.getUserDataProperty('_id')
  const topId = _id
  const _ids = _id ? [_id] : getEntryPointInstances()
    .filter(instance => instance._type !== 'page.error')
    .sort((a, b) => a.url > b.url ? 1 : -1)
    .map(instance => instance._id)

  const flowPageInstance = produce(pageInstance, draft => {
    draft.heading = 'Page flow'
    const getFlowStep = (_id, start) => {
      let flowStep = getInstance(_id)
      flowStep = produce(flowStep, flowDraft => {
        flowDraft.EDITMODE = 'flow'
        flowDraft.MODE = 'flow'
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
        renderInstance = setService(renderInstance, pageData)
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
                // let parentNextSibling
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
                  const getConditionString = (condition) => {
                    let conditionString = ''
                    const {all, any, exactly, identifier, identifierType, operator, negated, value} = condition
                    if (identifier) {
                      if (!identifierType || identifierType === 'input') {
                        const nameInstanceId = getInstanceIdByPropertyValue('name', identifier)
                        if (nameInstanceId) {
                          const nameTitle = getInstanceTitle(nameInstanceId)
                          const nameOperator = evaluationOperators[operator] || {}
                          const operatorString = nameOperator[negated ? 'no' : 'yes'] || operator
                          // conditionString = 'The answer to '
                          conditionString += `<b>${nameTitle}</b> ${operatorString}`
                          if (value !== undefined) {
                            conditionString += ` ${value}`
                          }
                        } else {
                          // console.log(identifier, 'did not have an instance')
                        }
                      }
                    }
                    const getConditionsString = (conditions, type, metString, delimiter) => {
                      let conditionsString = ''
                      if (conditions.length === 1) {
                        conditionsString = getConditionString(conditions[0])
                      } else {
                        conditionsString = `<div class="fb-conditions fb-conditions-${type}">`
                        conditionsString += '<p>All of these conditions are met</p>'
                        const subConditions = conditions.map(subCondition => getConditionString(subCondition))
                          .map((str, index) => `<li>${str}${index < conditions.length - 1 ? ` <span class="fb-conditions-delimiter">${delimiter}</span>` : ''}</li>`)
                        conditionsString += `<ul class="fb-conditions-list">${subConditions.join('')}</ul>`
                        conditionsString += '</div>'
                      }
                      return conditionsString
                    }
                    if (all) {
                      conditionString = getConditionsString(all, 'all', 'All of these conditions are met', 'and')
                    } else if (any) {
                      conditionString = getConditionsString(any, 'any', 'At least one of these conditions are met', 'and/or')
                    } else if (exactly) {
                      conditionString = getConditionsString(exactly, 'exactly', 'One of these conditions are met', 'or')
                    }
                    return conditionString
                  }
                  drafty.$showConditions = getConditionString(show)
                  // drafty.$showConditions += JSON.stringify(show, null, 2)
                }
                if (drafty.$stepSkipFirst) {
                  drafty.$showValues = ['yes', 'no']
                }
                if (drafty.$stepOption) {
                  let alternativeValue = nextAlternative || previousAlternative
                  let value = alternativeValue.value
                  if (value === undefined) {
                    if (alternativeValue.operator === 'defined') {
                      value = alternativeValue.negated ? 'Does not exist' : 'Exists'
                    } else if (alternativeValue.operator === 'isTrue') {
                      value = alternativeValue.negated ? 'Is not true' : 'Is true'
                    }
                  }
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
