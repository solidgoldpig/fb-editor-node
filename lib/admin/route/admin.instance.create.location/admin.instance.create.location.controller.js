const instanceCreateLocationController = {}
const jp = require('jsonpath')

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
    pageInstance.redirect = getUrl('admin.instance.create.type', locationParams)

    return pageInstance
  }

  const pagesWithSteps = getInstancesByPropertyValue('_type', 'page.start')
    .concat(getInstancesByPropertyValue('enableSteps', true))
    .filter(instance => {
      if (instance.$source.startsWith('module:')) {
        return false
      }
      if (instance.url === '/') {
        return true
      }
      return instance.enableSteps || instance.steps && instance.steps.length
    })
    // .sort((a, b) => a.url > b.url)
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

  const nameNode = jp.query(pageInstance, '$..[?(@.name === "location")]')[0]
  pagesWithSteps.reverse().forEach((locationOption, index) => {
    nameNode.items.unshift(locationOption)
  })

  return pageInstance
}

module.exports = instanceCreateLocationController
