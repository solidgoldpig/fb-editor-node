const instanceCreateLocationController = {}
const jp = require('jsonpath')
const {default: produce} = require('immer')

const serviceData = require('../../../service-data/service-data')
const {
  getInstancesByPropertyValue,
  getInstanceTitle
} = serviceData

instanceCreateLocationController.setData = (pageInstance, pageData, POST) => {
  const {pagesMethods} = pageData
  const {getUrl} = pagesMethods

  const location = pageData.getUserDataProperty('location')

  if (location) {
    pageInstance = produce(pageInstance, draft => {
      let locationParams = {
        instanceType: 'page'
      }
      if (location !== 'standalone') {
        locationParams = {
          addId: location,
          addProperty: 'steps',
          operation: 'edit'
        }
      }
      draft.redirect = getUrl('admin.instance.create.type', locationParams)
      return draft
    })
    return pageInstance
  }

  const pagesWithSteps = getInstancesByPropertyValue('enableSteps', true)
    .concat(getInstancesByPropertyValue('_type', 'page.start'))
    .filter(instance => {
      if (instance.url === '/') {
        return true
      }
      return instance.steps.length || instance.enableSteps
    })
    .sort((a, b) => a.url > b.url)
    .map(instance => {
      let mainPage = instance.url === '/' ? ' (main page)' : ''
      if (mainPage) {
        pageData.setUserDataProperty('location', instance._id)
      }
      return {
        _type: 'radio',
        value: instance._id,
        label: getInstanceTitle(instance._id) + mainPage
      }
    })

  pageInstance = produce(pageInstance, draft => {
    const nameNode = jp.query(draft, '$..[?(@.name === "location")]')[0]
    pagesWithSteps.reverse().forEach((locationOption, index) => {
      nameNode.items.unshift(locationOption)
    })
    return draft
  })

  return pageInstance
}

module.exports = instanceCreateLocationController
