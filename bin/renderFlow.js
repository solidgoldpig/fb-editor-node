#!/usr/bin/env node

const fkill = require('fkill')
const puppeteer = require('puppeteer')

const renderPage = async (url) => {
  const browser = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  })

  const browserProcessID = browser.process().pid

  try {
    const page = await browser.newPage()
    await page.goto(url)

    await page.emulateMedia('screen')

    const width = await page.evaluate('document.body.scrollWidth')
    const height = await page.evaluate('document.body.scrollHeight')

    await page.setViewport({
      width,
      height
    })
    await page.pdf({
      scale: 1,
      width: `${width}px`,
      height: `${height + 150}px`,
      printBackground: true,
      margin: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0
      },
      displayHeaderFooter: false,
      path: '/tmp/flow.pdf'
    })
    // scale: 0.75,
    // format: 'A4',
    // margin: {
    //   bottom: '1cm'
    // },

    await page.screenshot({path: '/tmp/flow.png'})

    await page.goto('about:blank')
    await page.close()
    await browser.close()
  } catch (err) {
    fkill(browserProcessID).catch(() => {})
    throw err
  }

  fkill(browserProcessID).catch(() => {})
}

renderPage('http://localhost:3000/admin/flow?print=1')
