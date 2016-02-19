'use strict'
const write = require('fs').writeFileSync
const normalize = require('path').normalize
const request = require('request')
const cheerio = require('cheerio')
const chalk = require('chalk')
const progressBar = require('progress-bar')

const URL_BASE = 'http://community.bistudio.com'
const URL_FNC = `${URL_BASE}/wiki/Category:Arma_3:_Functions`
const OUTPUT_FILE = normalize(`${__dirname}/../../settings/language-sqf-functions-bis.json`)
const MAX_REQUEST_RETRIES = 10

let scrapeURL = (siteUrl) => {
  return new Promise((resolve, reject) => {
    request(siteUrl, (err, res, html) => {
      if (err) return reject(err)
      if (res.statusCode !== 200) {
        return reject(new Error(`Wrong HTTP code ${res.statusCode} for URL ${siteUrl}, expected 200`))
      }

      resolve(html)
    })
  })
}

let parseMainTable = (html) => {
  let $ = cheerio.load(html)
  let root = $('#mw-pages table').first()
  let ret = []

  root.find('h3').each(function () {
    $(this).next().find('li a[href]').each(function () {
      let $this = $(this)
      let text = $this.attr('title').trim().replace(/\s/g, '_') // replace space with _
      let descriptionMoreURL = URL_BASE + $this.attr('href').trim()

      ret.push({
        text,
        rightLabel: 'BIS Function',
        type: 'function',
        description: '',
        descriptionMoreURL
      })
    })
  })

  return ret
}

let getAllFunctionsDescription = (fncs) => {
  let ret = []
  let completed = 0
  let expected = fncs.length
  let bar = progressBar.create(process.stdout)
  console.log(chalk.green('Retrieving function descriptions'))

  fncs.forEach((fnc, i) => {
    ret.push(new Promise((resolve, reject) => {
      getFunction(fnc.descriptionMoreURL)
      .then(html => {
        resolve()
        bar.update(++completed / expected)
      })
      .catch(e => {
        reject(e)
      })
    }))
  })

  return ret
}

let getFunction = (url) => {
  return new Promise((resolve, reject) => {
    let tryRequest = (amountAttempts) => {
      scrapeURL(url)
      .then(html => resolve(html))
      .catch(e => {
        if (++amountAttempts >= MAX_REQUEST_RETRIES) return reject(e)
        setTimeout(() => {
          tryRequest(amountAttempts)
        }, 100 * amountAttempts)
      })
    }

    tryRequest(0)
  })
}

let parseFunctionDescription = (html) => {

}

scrapeURL(URL_FNC)
.then(html => {
  let fncs = parseMainTable(html)
  console.log(chalk.green(`Found ${fncs.length} functions`))

  Promise.all(getAllFunctionsDescription(fncs))
  .then(() => {
    let data = {
      '.source.sqf': {
        'autocomplete': {
          'symbols': {
            'BISfunctions': {
              'suggestions': fncs
            }
          }
        }
      }
    }

    write(OUTPUT_FILE, JSON.stringify(data, null, 2))
    console.log(chalk.green(`\nDone, created ${OUTPUT_FILE}`))
  })
  .catch((err) => {
    console.log(chalk.red(err))
  })
})
.catch((err) => {
  console.log(chalk.red(err))
})
