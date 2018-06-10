/*
 * Copyright (c) 2018 @josemlp91 All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 */

const codeGenerator = require('./code-generator');

function getGenOptions () {
  return {
    installPath: app.preferences.get('django.gen.installPath'),
    djangoModelsPackage: app.preferences.get('django.gen.djangoModelsPackage'),
    useTab: app.preferences.get('django.gen.useTab'),
    indentSpaces: app.preferences.get('django.gen.indentSpaces'),
    docString: app.preferences.get('django.gen.docString')
  };
}

/**
 * Command Handler for Python Code Generation
 *
 * @param {Element} base
 * @param {string} path
 * @param {Object} options
 */
function _handleGenerate (base, path, options) {
  // If options is not passed, get from preference
  options = options || getGenOptions();
  
  // If base is not assigned, popup ElementPicker
  if (!base) {
    app.elementPickerDialog.showDialog('Select a base model to generate codes', null, type.UMLPackage).then(function ({buttonId, returnValue}) {
      if (buttonId === 'ok') {
        base = returnValue;
        // If path is not assigned, popup Open Dialog to select a folder
        if (!path) {
          var files = app.dialogs.showOpenDialog('Select a folder where generated codes to be located', null, null, { properties: [ 'openDirectory' ] });
          if (files && files.length > 0) {
            path = files[0];
            codeGenerator.generate(base, path, options);
          }
        } else {
          codeGenerator.generate(base, path, options);
        }
      }
    });
  } else {
    // If path is not assigned, popup Open Dialog to select a folder
    if (!path) {
      var files = app.dialogs.showOpenDialog('Select a folder where generated codes to be located', null, null, { properties: [ 'openDirectory' ] });
      if (files && files.length > 0) {
        path = files[0];
        codeGenerator.generate(base, path, options);
      }
    } else {
      codeGenerator.generate(base, path, options);
    }
  }
}

/**
 * Popup PreferenceDialog with Django Preference Schema
 */
function _handleConfigure () {
  app.commands.execute('application:preferences', 'django');
}

function init () {
  app.commands.register('django:generate', _handleGenerate);
  app.commands.register('django:configure', _handleConfigure);
}

exports.init = init;
