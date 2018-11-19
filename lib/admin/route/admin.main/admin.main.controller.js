const adminController = {}
const jp = require('jsonpath')
const {default: produce} = require('immer')

const serviceData = require('../../../service-data/service-data')
const {
  getInstanceTitle,
  getInstanceProperty
} = serviceData

// const {getNavigation, getPagesMethods: metadataMethods} = require('@ministryofjustice/fb-runner-node/lib/middleware/routes-metadata/routes-metadata')

adminController.setData = (pageInstance, pageData, POST) => {
  const {pagesMethods} = pageData
  const {getUrl} = pagesMethods

  // const pageStart = metadataMethods().getData('/').route
  let pages = serviceData.getEntryPointInstances().sort((a, b) => a.url > b.url ? 1 : -1)

  let pagesStr = ''

  const addPage = (_id, depth = '') => {
    const title = getInstanceTitle(_id)
    let href = `${getInstanceProperty(_id, 'url')}/edit` // getUrl('admin.instance', {_id})
    if (href === '//edit') {
      href = '/edit'
    }
    pagesStr += `${depth}- [${title}](${href})\n`

    const steps = getInstanceProperty(_id, 'steps') || []
    steps.forEach(step => {
      addPage(step, `${depth}  `)
    })
  }

  pages.forEach(page => {
    addPage(page._id)
  })

  pageData.setUserDataProperty('pages', pagesStr)

  // const categories = getServiceSchemaCategories()
  // pageInstance = produce(pageInstance, draft => {
  //   const list = jp.query(draft, '$..[?(@._id === "admin.main--list")]')[0]
  //   list.items = categories.map(category => {
  //     return {
  //       text: category,
  //       href: getUrl('admin.category', {category})
  //     }
  //   })
  //   list.items = pages

  //   return draft
  // })

  return pageInstance
}

module.exports = adminController
