const jp = require('jsonpath')
const serviceData = require('@solidgoldpig/fb-runner-node/lib/service-data/service-data')
const {initRoutes} = require('@solidgoldpig/fb-runner-node/lib/middleware/routes-metadata/routes-metadata')

const originalLoadServiceData = serviceData.loadServiceData

serviceData.loadServiceData = () => {
  return originalLoadServiceData()
    .then(serviceData => {
      initRoutes()
      return serviceData
    })
}

// initRoutes

serviceData.getServiceSchemaCategories = () => {
  const categories = []
  const schemas = serviceData.getServiceSchemas()
  Object.keys(schemas).forEach(schema => {
    const {category} = schemas[schema]
    if (category) {
      category.forEach(cat => {
        if (cat.match(/^(definition|option|.+Page)$/)) {
          return
        }
        if (!categories.includes(cat)) {
          categories.push(cat)
        }
      })
    }
  })
  return categories.sort()
}

serviceData.getSchemaTitle = (type) => {
  return serviceData.getServiceSchema(type).title
}

serviceData.getInstanceType = (_id) => {
  return serviceData.getInstanceProperty(_id, '_type')
}

serviceData.getInstancesByType = (query, options = {}) => {
  let instances = serviceData.getServiceInstances()
  if (options.nested) {
    const toplevelKeys = Object.keys(instances)
    const jpInstances = jp.query(instances, '$..[?(@._id)]')
    instances = {}
    jpInstances.forEach(instance => {
      if (!toplevelKeys.includes(instance._id)) {
        instances[instance._id] = instance
      }
    })
  }
  const instanceKeys = Object.keys(instances)
  let wantedInstances = []
  if (typeof query === 'string') {
    wantedInstances = instanceKeys.filter(_id => instances[_id]._type === query)
  } else {
    wantedInstances = instanceKeys.filter(_id => {
      Object.keys(query).forEach(key => {
        if (instances[_id][key] !== query[key]) {
          return false
        }
      })
      return true
    })
  }
  wantedInstances = wantedInstances.filter(instance => instance !== 'page.admin')
  if (options.count) {
    return wantedInstances.length
  }
  return wantedInstances
}

module.exports = serviceData
