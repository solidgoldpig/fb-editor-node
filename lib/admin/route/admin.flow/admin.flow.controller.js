const jp = require('jsonpath')
const deepEqual = require('deep-equal')
const {deepClone} = require('@ministryofjustice/fb-utils-node')
const produce = (i, fn) => fn(deepClone(i))

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
const {getInstanceController} = require('@ministryofjustice/fb-runner-node/lib/controller/controller')
const evaluationOperators = getEvaluationOperators()
evaluationOperators.defined = {
  yes: 'is answered',
  no: 'is not answered'
}

const {
  setControlNames,
  setRepeatable,
  setComposite,
  kludgeUpdates,
  setDefaultValues,
  setFormContent,
  formatProperties,
  setService
} = require('@ministryofjustice/fb-runner-node/lib/page/page')

const flowController = {}

let stepCache = {}

const getSourceStepWithShow = (step) => {
  if (!step) {
    return
  }
  if (step._type === 'page.confirmation') {
    // TODO: update propagateInstanceConditions to not propagate single content fields
    return
  }
  if (!stepCache[step._id]) {
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
    stepCache[step._id] = propgatedSteps[step._id]
  }
  return stepCache[step._id]
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

const getConditionString = (condition, nested) => {
  let conditionString = ''
  const {all, any, exactly, identifier, identifierType, operator, negated, value} = condition
  if (identifier) {
    if (!identifierType || identifierType === 'input') {
      const nameInstanceId = getInstanceIdByPropertyValue('name', identifier)
      if (nameInstanceId) {
        const nameTitle = getInstanceTitle(nameInstanceId)
        const nameInstance = getInstance(nameInstanceId)
        const nameOperator = evaluationOperators[operator] || {}
        let operatorString = nameOperator[negated ? 'no' : 'yes'] || operator

        if (!nested) {
          if (operatorString === 'is') {
            operatorString = ''
          }
          if (nameInstance._type === 'checkbox' && operator === 'defined') {
            operatorString = negated ? 'is not selected' : 'is selected'
          }
        }
        // conditionString = 'The answer to '
        conditionString += `<b>${nameTitle}</b> ${operatorString}`
        if (value !== undefined) {
          let answer = value
          // NB. this is essentially duplicated from runner's summary controller
          // TODO: extract to method
          if (nameInstance._type === 'checkboxes') {
            if (nameInstance.items) {
              const values = nameInstance.items.filter(item => {
                let itemValue = item.value
                if (itemValue === undefined) {
                  itemValue = 'yes'
                }
                return itemValue === value
              }).map(item => {
                return getInstanceTitle(item._id) || item.value
              })
              if (values.length === 0) {
                values.push('None')
              }
              answer = values.join('\n\n')
            }
          } else {
            if (nameInstance.items) {
              let nameItem = nameInstance.items.filter(item => item.value === value)[0]
              answer = nameItem ? getInstanceTitle(nameItem._id) : answer
            }
          }
          // end duplication
          conditionString += ` ${answer}`
        }
      } else {
        // console.log(identifier, 'did not have an instance')
      }
    }
  }
  const getConditionsString = (conditions, type, metString, delimiter) => {
    let conditionsString = ''
    if (conditions.length === 1) {
      conditionsString = getConditionString(conditions[0], true)
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

const renderPage = (pageInstance, pageData) => {
  const {nunjucks} = pageData
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

const getFlowStep = (_id, pageData, options = {}) => {
  const {topId, start} = options
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

    let renderInstance = deepClone(flowDraft)
    const controller = getInstanceController(flowDraft)
    if (controller.setContents) {
      renderInstance = controller.setContents(renderInstance, pageData)
    }

    // Is there any reason to actually set the control names?
    renderInstance = setControlNames(renderInstance, pageData)
    renderInstance = setRepeatable(renderInstance, pageData, true)
    renderInstance = setComposite(renderInstance, pageData)
    if (controller.preUpdateContents) {
      // renderInstance = await controller.preUpdateContents(renderInstance, pageData)
    }

    jp.apply(renderInstance, '$..[?(@._type)]', componentInstance => {
      const componentInstanceController = getInstanceController(componentInstance)

      if (componentInstanceController.preUpdateContents) {
        componentInstance = componentInstanceController.preUpdateContents(componentInstance, pageData, renderInstance)
      }
      return componentInstance
    })

    renderInstance = setFormContent(renderInstance, pageData)
    renderInstance = setService(renderInstance, pageData)
    renderInstance = setDefaultValues(renderInstance, pageData)
    renderInstance = formatProperties(renderInstance, pageData)
    renderInstance = kludgeUpdates(renderInstance, pageData)
    let rendered = renderPage(renderInstance, pageData)
    rendered = rendered.replace(/[\s\S]*?<header/, '<header')
      .replace(/<\/footer>[\s\S]*/, '</footer>')
      .replace(/<script[\s\S]+?<\/script>/g, '')
      .replace(/<style[\s\S]+?<\/style>/g, '')
    flowDraft.rendered = rendered
    flowDraft.title = getInstanceTitle(_id)
    flowDraft.url = flowDraft.url.replace(/\{[^}]+\}/g, '1')
      .replace(/\/:[^/]+/g, '/1')
    if (flowDraft.steps) {
      if (typeof flowDraft.showSteps === 'object') {
        flowDraft.$skipSubSteps = true
        flowDraft.$showStepsConditions = getConditionString(flowDraft.showSteps)
        flowDraft.$showStepsValues = ['Yes', 'No']
      }
      flowDraft.flowsteps = flowDraft.steps.map(stepId => getFlowStep(stepId, pageData, {topId}))
      flowDraft.flowsteps.forEach((draftStep, index, arr) => {
        if (draftStep.show && typeof draftStep.show === 'object') {
          const parentStep = draftStep._parent ? getInstance(draftStep._parent) : undefined
          let nextStep = arr[index + 1]
          if (!nextStep && parentStep) {
            let checkParentStep = parentStep
            while (!nextStep && checkParentStep) {
              let grandParentSteps = getInstanceProperty(checkParentStep._parent, 'steps')
              let parentIndex = grandParentSteps.indexOf(checkParentStep._id)
              const nextStepId = grandParentSteps[parentIndex + 1]
              nextStep = getInstance(nextStepId)
              if (!nextStep) {
                checkParentStep = getInstance(checkParentStep._parent)
              }
            }
          }
          let previousStep = arr[index - 1]
          if (!previousStep && parentStep) {
            let checkParentStep = parentStep
            while (!previousStep && checkParentStep) {
              let grandParentSteps = getInstanceProperty(checkParentStep._parent, 'steps')
              let parentIndex = grandParentSteps.indexOf(checkParentStep._id)
              const nextStepId = grandParentSteps[parentIndex - 1]
              previousStep = getInstance(nextStepId)
              if (!previousStep) {
                checkParentStep = getInstance(checkParentStep._parent)
              }
            }
          }
          const draftStepSourceInstance = getSourceStepWithShow(draftStep)
          const nextStepSourceInstance = getSourceStepWithShow(nextStep)
          const previousStepSourceInstance = getSourceStepWithShow(previousStep)
          let nextSame = isSameCondition(draftStepSourceInstance, nextStepSourceInstance)
          let previousSame = isSameCondition(draftStepSourceInstance, previousStepSourceInstance)

          const nextAlternative = isAlternativeCondition(draftStepSourceInstance, nextStepSourceInstance)
          const previousAlternative = isAlternativeCondition(draftStepSourceInstance, previousStepSourceInstance)

          const stepsInstance = arr[index]
          if (nextAlternative || previousAlternative) {
            stepsInstance.$stepOption = true
            if (!nextAlternative) {
              stepsInstance.$stepOptionLast = true
            }
            if (!previousAlternative) {
              stepsInstance.$stepOptionFirst = true
            }
          }
          if (nextSame || previousSame) {
            stepsInstance.$stepSkip = true
            if (!nextSame) {
              stepsInstance.$stepSkipLast = true
            }
            if (!previousSame) {
              stepsInstance.$stepSkipFirst = true
            }
          }
          if (nextStep && !nextAlternative && !previousAlternative && !nextSame && !previousSame) {
            stepsInstance.$stepSkip = true
            stepsInstance.$stepSkipLast = true
            stepsInstance.$stepSkipFirst = true
          }
          // this condition prevents alternative options working - unsure of what this actually catered for
          // if (index + 1 === arr.length) {
          //   if (!previousSame) {
          //     drafty.$stepSkip = true
          //     drafty.$stepSkipLast = true
          //     drafty.$stepSkipFirst = true
          //   }
          // }

          if (stepsInstance.$stepSkipFirst || stepsInstance.$stepOptionFirst) {
            let show = deepClone(draftStepSourceInstance.show)
            if (stepsInstance.$stepOption && show.identifier) {
              delete show.value
            }
            stepsInstance.$showConditions = getConditionString(show)
            // drafty.$showConditions += JSON.stringify(show, null, 2)
          }
          if (stepsInstance.$stepSkipFirst) {
            stepsInstance.$showValues = ['Yes', 'No']
          }
          if (stepsInstance.$stepOption) {
            let alternativeValue = nextAlternative || previousAlternative
            let value = alternativeValue.value
            if (value === undefined) {
              if (alternativeValue.operator === 'defined') {
                value = alternativeValue.negated ? 'Does not exist' : 'Exists'
              } else if (alternativeValue.operator === 'isTrue') {
                value = alternativeValue.negated ? 'Is not true' : 'Is true'
              }
            } else {
              if (draftStepSourceInstance.show) {
                let nameTitle
                const nameInstanceId = getInstanceIdByPropertyValue('name', draftStepSourceInstance.show.identifier)
                if (nameInstanceId) {
                  const items = getInstance(nameInstanceId).items
                  if (items) {
                    for (let item of items) {
                      if (value === item.value) {
                        nameTitle = getInstanceTitle(item._id)
                      }
                    }
                  } else {
                    nameTitle = getInstanceTitle(nameInstanceId)
                  }

                  value = nameTitle || value
                }
              }
            }
            stepsInstance.$showValues = [value]
          }
          arr[index] = stepsInstance
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
    return flowDraft
  })
  return flowStep
}

flowController.setData = (pageInstance, pageData) => {
  stepCache = {}

  const _id = pageData.getUserDataProperty('_id')
  const topId = _id
  const _ids = _id ? [_id] : getEntryPointInstances()
    .filter(instance => instance._type !== 'page.error')
    .sort((a, b) => a.url > b.url ? 1 : -1)
    .map(instance => instance._id)

  pageInstance.heading = 'Page flow'

  pageInstance.flowsteps = _ids.map(_id => getFlowStep(_id, pageData, {
    start: true,
    topId
  }))

  pageInstance = setFormContent(pageInstance, pageData)
  pageInstance = setService(pageInstance, pageData)
  pageInstance = formatProperties(pageInstance, pageData)
  pageInstance = kludgeUpdates(pageInstance, pageData)

  return pageInstance
}

module.exports = flowController
