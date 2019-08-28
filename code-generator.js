/*
 * Copyright (c) 2018 @joseml91 All rights reserved.
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

const fs = require('fs');
const path = require('path');
const codegen = require('./codegen-utils');

/**
 *  Code Generator
 */
class DjangoCodeGenerator {
  /**
   * @constructor
   *
   * @param {type.UMLPackage} baseModel
   * @param {string} basePath generated files and directories to be placed
   */
  constructor (baseModel, basePath) {
    /** @member {type.Model} */
    this.baseModel = baseModel;

    /** @member {string} */
    this.basePath = basePath;
  }

  /**
   * Return Indent String based on options
   * @param {Object} options
   * @return {string}
   */
  getIndentString (options) {
    if (options.useTab) {
      return '\t';
    } else {
      var i, len;
      var indent = [];
      for (i = 0, len = options.indentSpaces; i < len; i++) {
        indent.push(' ');
      }
      return indent.join('');
    }
  }

  /**
   * Collect inheritances (super classes or interfaces) of a given element
   * @param {type.Model} elem
   * @return {Array.<type.Model>}
   */
  getInherits (elem) {
    var inherits = app.repository.getRelationshipsOf(elem, function (rel) {
      return (rel.source === elem && (rel instanceof type.UMLGeneralization || rel instanceof type.UMLInterfaceRealization));
    });

    return inherits.map(function (gen) { 
      //console.log(gen.target);
      return gen.target; 
    });
  }

  /**
   * Collect UMLAssociationClassLinks (relations for intermediate tables) that reference a given element
   * @param elem
   * @returns {null}
   */
  getClassLinks (elem) {
    return app.repository.getRefsTo(elem, ref => {
      return (ref instanceof type.UMLAssociationClassLink);
    });
  }

  /**
   * Write Doc
   * @param {StringWriter} codeWriter
   * @param {string} text
   * @param {Object} options
   */
  writeDoc (codeWriter, text, options) {
    var i, len, lines;
    if (options.docString && text.trim().length > 0) {
      lines = text.trim().split('\n');
      if (lines.length > 1) {
        codeWriter.writeLine('"""');
        for (i = 0, len = lines.length; i < len; i++) {
          codeWriter.writeLine(lines[i]);
        }
        codeWriter.writeLine('"""');
      } else {
        codeWriter.writeLine('"""' + lines[0] + '"""');
      }
    }
  }

    /**
   * Write Meta
   * @param {StringWriter} codeWriter
   * @param {string} text
   * @param {Object} options
   */
  writeMeta (codeWriter, elem, options) {
    
    var is_blank=true;

    codeWriter.writeLine('class Meta:');
    codeWriter.indent();
    if (elem.isAbstract){
      codeWriter.writeLine('abstract = True');
      is_blank = false;      
    }

    var tags = elem.tags;
    var tag;

    for (var i = 0, len = tags.length; i < len; i++) {

      is_blank = false; 
      tag = tags[i];

      if (tag.kind == "string"){
        codeWriter.writeLine(tag.name + "='" + tag.value.trim().split('\n') + "'");

      } else if (tag.kind == "number"){
        codeWriter.writeLine(tag.name + "=" + tag.number);

      } else if (tag.kind == "boolean"){
        if (tag.checked){
          codeWriter.writeLine(tag.name + "=True");        
        } else {
          codeWriter.writeLine(tag.name + "=False");
        }
      }
    }
  
    if (is_blank){
      codeWriter.writeLine('pass');
    }
    codeWriter.outdent();
    codeWriter.writeLine();
  }

  /**
   * Write Variable
   * @param {StringWriter} codeWriter
   * @param {type.Model} elem
   * @param {Object} options
   */
  writeVariable (codeWriter, elem, options, isClassVar) {
    if (elem.name.length > 0) {
      var line;

      if (isClassVar) {
        line = elem.name;
      
      } else {
        line = 'self.' + elem.name;
      }

      if (elem.multiplicity && ['0..*', '1..*', '*'].includes(elem.multiplicity.trim())) {
        line += ' = []';
      
      } else if (elem.defaultValue && elem.defaultValue.length > 0) {
        line += ' = ' + elem.defaultValue;
      
      } else {
        line += ' = None';
      }
      codeWriter.writeLine(line);
    }
  }

  /**
   * Write Attribute
   * @param {StringWriter} codeWriter
   * @param {type.Model} elem
   * @param {Object} options
   */
  writeAttribute (codeWriter, elem, options, isClassVar) {
    if (elem.name.length > 0) {
      
      var line;
      line = elem.name;
      
      if (elem.multiplicity && ['0..*', '1..*', '*'].includes(elem.multiplicity.trim())) {
        line += ' = []';

      } else if (elem.defaultValue && elem.defaultValue.length > 0) {
        line += ' = ' + elem.defaultValue;

      } else if (elem.type){
        line += ' = ' + mapBasicTypesToDjangoFieldClass(elem);
        
      } else {
        line += ' = None';
      }
      codeWriter.writeLine(line);
    }
  }


  /**
   * Write Constructor
   * @param {StringWriter} codeWriter
   * @param {type.Model} elem
   * @param {Object} options
   */
  writeConstructor (codeWriter, elem, options) {
    var self = this;
    var hasBody = false;
    codeWriter.writeLine('def __init__(self):');
    codeWriter.indent();

    // from attributes
    if (elem.attributes.length > 0) {
      elem.attributes.forEach(function (attr) {
        if (attr.isStatic === false) {
          self.writeVariable(codeWriter, attr, options, false);
          hasBody = true;
        }
      });
    }

    // from associations
    var associations = app.repository.getRelationshipsOf(elem, function (rel) {
      return (rel instanceof type.UMLAssociation);
    });
    for (var i = 0, len = associations.length; i < len; i++) {
      var asso = associations[i];
      if (asso.end1.reference === elem && asso.end2.navigable === true) {
        self.writeVariable(codeWriter, asso.end2, options);
        hasBody = true;
      }
      if (asso.end2.reference === elem && asso.end1.navigable === true) {
        self.writeVariable(codeWriter, asso.end1, options);
        hasBody = true;
      }
    }

    if (!hasBody) {
      codeWriter.writeLine('pass');
    }

    codeWriter.outdent();
    codeWriter.writeLine();
  }

  /**
   * Write Method
   * @param {StringWriter} codeWriter
   * @param {type.Model} elem
   * @param {Object} options
   */
  writeMethod (codeWriter, elem, options) {
    if (elem.name.length > 0) {

      
      // name
      var line = 'def ' + elem.name;

      // params
      var params = elem.getNonReturnParameters();
      var paramStr = params.map(function (p) { 
        return p.name;
      }).join(', ');

      

      if (elem.isStatic) {
        codeWriter.writeLine('@classmethod');
        codeWriter.writeLine(line + '(cls, ' + paramStr + '):');
      } else {
        if (elem.isQuery){
          codeWriter.writeLine('@property');
        }
        codeWriter.writeLine(line + '(self, ' + paramStr + '):');
      }
      codeWriter.indent();
      this.writeDoc(codeWriter, elem.documentation, options);
      codeWriter.writeLine('pass');
      codeWriter.outdent();
      codeWriter.writeLine();
    }
  }

  /**
   * Write writeRealation
   * @param {StringWriter} codeWriter
   * @param {type.Model} elem
   * @param {type.Model} asso
   * @param {Object} options
   */
  writeRealation (codeWriter, elem, asso, options) {

    var tags = asso.tags;
    var tags_str = "";

    // console.log(tags);
    tags_str += getTagsString(tags);

    if (tags_str){
      tags_str = ", " + tags_str;
    }

    if ("classSide" in asso && asso.classSide === elem) {  // This is an intermediate model
        var end1 = asso.associationSide.end1;
        var end2 = asso.associationSide.end2;
        if (end1.navigable === true && end2.navigable === true && end1.multiplicity && end2.multiplicity
            && ['0..*', '1..*', '*'].includes(end1.multiplicity.trim()) && ['0..*', '1..*', '*'].includes(end2.multiplicity.trim())) {
          var end;
          for (end of [end1, end2]) {
            var refObjName = end.reference.name;
            var var_name = refObjName.toLowerCase();
            codeWriter.writeLine(var_name + " = models.ForeingKey('" + refObjName + "'" + tags_str + ", on_delete=models.PROTECT)");
          }
        }
    } else if (asso.end1.reference === elem && asso.end2.navigable === true && asso.end2.multiplicity && asso.end1.multiplicity) {       
        if (asso.end1.multiplicity == "1" && asso.end2.multiplicity == "1"){
          var refObjName = asso.end2.reference.name;
          var var_name = asso.name;
          codeWriter.writeLine(var_name + " = models.OneToOneField('" + refObjName + "'"+ tags_str +")");
        }

        if (['0..*', '1..*', '*'].includes(asso.end1.multiplicity.trim()) && asso.end2.multiplicity == "1"){
          var refObjName = asso.end2.reference.name;
          var var_name = asso.name;
          codeWriter.writeLine(var_name + " = models.ForeignKey('" + asso.end2.reference.name + "'" + tags_str +", on_delete=models.PROTECT)");
        }

        if (['0..*', '1..*', '*'].includes(asso.end1.multiplicity.trim()) && ['0..*', '1..*', '*'].includes(asso.end2.multiplicity.trim())){
          var refObjName = asso.end2.reference.name;
          var var_name = asso.name;

          // If 'through' tag not already in tags...
          if (!('through' in tags)) {
            var references = this.getClassLinks(asso);
            if (references.length > 0) {  // There should be one at most.
              tags_str = ', through=' + "'" + references[0].classSide.name + "'" + tags_str;
            }
          }
          codeWriter.writeLine(var_name + " = models.ManyToMany('" + asso.end2.reference.name + "'"+ tags_str +")");

        }
    }
  }


  /**
   * Write Enum
   * @param {StringWriter} codeWriter
   * @param {type.Model} elem
   * @param {Object} options
   */
  writeEnum (codeWriter, elem, options) {
    var line = '';

    codeWriter.writeLine('from enum import Enum');
    codeWriter.writeLine();

    // Enum
    line = 'class ' + elem.name + '(Enum):';
    codeWriter.writeLine(line);
    codeWriter.indent();

    // Docstring
    this.writeDoc(codeWriter, elem.documentation, options);

    if (elem.literals.length === 0) {
      codeWriter.writeLine('pass');
    } else {
      for (var i = 0, len = elem.literals.length; i < len; i++) {
        codeWriter.writeLine(elem.literals[i].name + ' = ' + (i + 1));
      }
    }
    codeWriter.outdent();
    codeWriter.writeLine();
  }

  /**
   * Write Class
   * @param {StringWriter} codeWriter
   * @param {type.Model} elem
   * @param {Object} options
   */
  writeClass (codeWriter, elem, options) {
    var self = this;
    var line = '';
    var _inherits = this.getInherits(elem);

    // Import
    if (_inherits.length > 0) {
      _inherits.forEach(function (e) {
        var _path = e.getPath(self.baseModel).map(function (item) { return item.name; }).join('.');
        codeWriter.writeLine('from ' + _path + ' import ' + e.name);
      });
      codeWriter.writeLine();
    }

    // Class
    line = 'class ' + elem.name;

    // Inherits
    if (_inherits.length > 0) {
      line += '(' + _inherits.map(function (e) { return e.name; }).join(', ') + ')';
    } else {
      line += '(models.Model)';
    }

    codeWriter.writeLine(line + ':');
    codeWriter.indent();

    // Docstring
    this.writeDoc(codeWriter, elem.documentation, options);
    this.writeMeta(codeWriter, elem, options);

    var write_pass = true;


    if (elem.attributes.length !== 0) {
      elem.attributes.forEach(function (attr) {
        self.writeAttribute(codeWriter, attr, options, true);
      });

      codeWriter.writeLine();

      // Constructor
      // this.writeConstructor(codeWriter, elem, options)
      write_pass = false;
    }

    // from associations
    var associations = app.repository.getRelationshipsOf(elem, function (rel) {
      return (rel instanceof type.UMLAssociation);
    });

      // Relations
      for (var i = 0, len = associations.length; i < len; i++) {
        var asso = associations[i];
        self.writeRealation(codeWriter, elem, asso, options);
      }

      // from class links
      associations = this.getClassLinks(elem);

      // Relations
      for (var i = 0, len = associations.length; i < len; i++) {
        var asso = associations[i];
        self.writeRealation(codeWriter, elem, asso, options);
      }
      
      codeWriter.writeLine();
      write_pass = false;
    }


    // Methods
    if (elem.operations.length > 0) {
      elem.operations.forEach(function (op) {
        self.writeMethod(codeWriter, op, options);
      });
      write_pass = false;
    }

    if (write_pass) {
      codeWriter.writeLine('pass');
    }

    codeWriter.outdent();
    codeWriter.writeLine();
  }

  /**
   * Generate codes from a given element
   * @param {type.Model} elem
   * @param {string} path
   * @param {Object} options
   */
  generate (elem, basePath, options) {
    var result = new $.Deferred();
    var fullPath, codeWriter, file;

    // Package (a directory with __init__.py)
    if (elem instanceof type.UMLPackage) {
      fullPath = path.join(basePath, elem.name);
      fs.mkdirSync(fullPath);
      file = path.join(fullPath, '__init__.py');
      fs.writeFileSync(file, '');
      elem.ownedElements.forEach(child => {
        this.generate(child, fullPath, options);
      });

    // Class
    } else if (elem instanceof type.UMLClass || elem instanceof type.UMLInterface) {
      
      fullPath = basePath + '/' + elem.name.toLowerCase() + '.py';
      codeWriter = new codegen.CodeWriter(this.getIndentString(options));
      
      //codeWriter.writeLine(options.installPath)
      codeWriter.writeLine('#-*- coding: utf-8 -*-');
      codeWriter.writeLine();
      codeWriter.writeLine(options.djangoModelsPackage);
      codeWriter.writeLine();
      this.writeClass(codeWriter, elem, options);
      fs.writeFileSync(fullPath, codeWriter.getData());

    // Enum
    } else if (elem instanceof type.UMLEnumeration) {
      fullPath = basePath + '/' + elem.name + '.py';
      codeWriter = new codegen.CodeWriter(this.getIndentString(options));
      codeWriter.writeLine(options.installPath);
      codeWriter.writeLine('#-*- coding: utf-8 -*-');
      codeWriter.writeLine();
      this.writeEnum(codeWriter, elem, options);
      fs.writeFileSync(fullPath, codeWriter.getData());

    // Others (Nothing generated.)
    } else {
      result.resolve();
    }
    return result.promise();
  }
}

function getTagsString(tags) {
  return tags.map(function (e) {
    if (e.kind == "string") {
      return e.name + "='" + e.value.trim().split('\n') + "'";
    } else if (e.kind == "number") {
      return e.name + "=" + e.number;
    } else if (e.kind == "boolean") {
      return e.name + (e.checked ? "=True" : "=False");
    } else if (e.kind == "reference") {
      return e.name + "=" + e.reference.name;
    }
  }).join(', ')
}

function mapBasicTypesToDjangoFieldClass(elem){
  var line = "";
  var type_maps = {
    "string": "models.CharField",
    "text": "models.TextField",
    "integer": "models.IntegerField",
    "decimal": "models.DecimalField",
    "boolean": "models.BooleanField",
    "date": "models.DateField",
    "datetime": "models.DateTimeField",
    "email": "models.EmailField",
    "file": "models.FileField",
  };

  line = type_maps[elem.type.name];

  var tags = elem.tags;

  line += '(' + getTagsString(tags) + ')';
  return line;
}


/**
 * Generate
 * @param {type.Model} baseModel
 * @param {string} basePath
 * @param {Object} options
 */
function generate (baseModel, basePath, options) {
    
  var fullPath;
  var djangoCodeGenerator = new DjangoCodeGenerator(baseModel, basePath);
  fullPath = basePath + '/' + baseModel.name.toLowerCase();
  if (!fs.existsSync(fullPath)){
    fs.mkdirSync(fullPath);
  }else{
    var buttonId = app.dialogs.showConfirmDialog("Exist a folder with the same name, overwrite?");
    if (buttonId === 'ok') {
      deleteFolderRecursive(fullPath);
      fs.mkdirSync(fullPath);
      app.dialogs.showInfoDialog("New folder creaded.");
    } else {
      app.dialogs.showErrorDialog("Canceled operation by user.");
    }
  }
  baseModel.ownedElements.forEach(child => {
    djangoCodeGenerator.generate(child, fullPath, options);
  });
}

var deleteFolderRecursive = function(path) {
  if (fs.existsSync(path)) {
    fs.readdirSync(path).forEach(function(file, index){
      var curPath = path + "/" + file;
      if (fs.lstatSync(curPath).isDirectory()) { // recurse
        deleteFolderRecursive(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};

exports.generate = generate;
