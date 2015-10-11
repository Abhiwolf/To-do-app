(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
require('angular-hint');
require('angular-hint-interpolation');
require('angular-hint-events');
require('angular-hint-modules');
require('angular-hint-events');
require('angular-hint-dom');
require('angular-hint-directives');
require('angular-hint-controllers');
require('angular-hint-log');


},{"angular-hint":71,"angular-hint-controllers":2,"angular-hint-directives":3,"angular-hint-dom":32,"angular-hint-events":34,"angular-hint-interpolation":44,"angular-hint-log":54,"angular-hint-modules":55}],2:[function(require,module,exports){
'use strict';

var nameToControllerMatch = {};
var controllers = {};
var hintLog = angular.hint = require('angular-hint-log');

/**
* Decorates $controller with a patching function to
* log a message if the controller is instantiated on the window
*/
angular.module('ngHintControllers', []).
  config(function ($provide) {
    $provide.decorator('$controller', function($delegate, $injector) {
        return function(ctrl, locals) {
          if(typeof ctrl == 'string') {
            ctrl = nameToControllerMatch[ctrl];
          }
          // patch methods on $scope
          if (!locals) {
           locals = {};
          }
          //If the controller is not in the list of already registered controllers
          //and it is not connected to the local scope, it must be instantiated on the window
          if(controllers[ctrl] == undefined && (!locals.$scope || !locals.$scope[ctrl])) {
            if(angular.version.minor <= 2) {
              hintLog.logMessage('It is against Angular best practices to instantiate a' +
              ' controller on the window. This behavior is deprecated in Angular 1.3.0');
            } else {
              hintLog.logMessage('Global instantiation of controllers was deprecated in Angular' +
              ' 1.3.0. Define the controller on a module.');
            }
          }
          var ctrlInstance = $delegate.apply(this, [ctrl, locals]);
          return ctrlInstance;
        }
    });
});

/**
* Save details of the controllers as they are instantiated
* for use in decoration.
*/
var originalModule = angular.module;
angular.module = function() {
  var module = originalModule.apply(this, arguments);
  var originalController = module.controller;
  module.controller = function(controllerName, controllerConstructor) {
    nameToControllerMatch[controllerName] = controllerConstructor;
    var firstLetter = controllerName.charAt(0);

    if(firstLetter !== firstLetter.toUpperCase() && firstLetter === firstLetter.toLowerCase()) {
      hintLog.logMessage('Controller best practices is to name the controller with an' +
        ' uppercase first letter. Check the name of ' + controllerName);
    }

    var splitName = controllerName.split('Controller');
    if(splitName.length == 1 || splitName[splitName.length - 1] !== '') {
      hintLog.logMessage('Controller best practices is for a controller name to end with '+
        '\'Controller\'. Check the name of ' + controllerName);
    }

    controllers[controllerConstructor] = controllerConstructor;
    return originalController.apply(this, arguments);
  };
  return module;
}

},{"angular-hint-log":54}],3:[function(require,module,exports){
'use strict';

var hintLog = angular.hint = require('angular-hint-log');
var ddLibData = require('./lib/ddLib-data');

var RESTRICT_REGEXP = /restrict\s*:\s*['"](.+?)['"]/;
var customDirectives = [];
var dasherize = require('dasherize');
var search = require('./lib/search');
var checkPrelimErrors = require('./lib/checkPrelimErrors');
var getKeysAndValues = require('./lib/getKeysAndValues');
var defaultDirectives = ddLibData.directiveTypes['angular-default-directives'].directives;
var htmlDirectives = ddLibData.directiveTypes['html-directives'].directives;

angular.module('ngHintDirectives', ['ngLocale'])
  .config(['$provide', function($provide) {
    $provide.decorator('$compile', ['$delegate', function($delegate) {
      return function(elem) {
        var messages=[];
        elem = angular.element(elem);
        for(var i = 0; i < elem.length; i+=2){
          if(elem[i].getElementsByTagName){
            var toSend = Array.prototype.slice.call(elem[i].getElementsByTagName('*'));
            var result = search(toSend, customDirectives);
            messages = messages.concat(result);
          }
        }
        return $delegate.apply(this, arguments);
      };
    }]);
  }]);


angular.module('ngLocale').config(function($provide) {
  var originalProvider = $provide.provider;
  $provide.provider = function(token, provider) {
    provider = originalProvider.apply($provide, arguments);
    if (token === '$compile') {
      var originalProviderDirective = provider.directive;
      provider.directive = function(dirsObj) {
        for(var prop in dirsObj){
          var propDashed = dasherize(prop);
          if(isNaN(+propDashed) &&
              !defaultDirectives[propDashed] &&
              !htmlDirectives[propDashed]) {
            var matchRestrict = dirsObj[prop].toString().match(RESTRICT_REGEXP);
            ddLibData.directiveTypes['angular-default-directives']
                .directives[propDashed] = (matchRestrict && matchRestrict[1]) || 'ACME';
          }
        }
        return originalProviderDirective.apply(this, arguments);
      };
    }
    return provider;
  };
});

var originalAngularModule = angular.module;
angular.module = function() {
  var module = originalAngularModule.apply(this, arguments);
  var originalDirective = module.directive;
  module.directive = function(directiveName, directiveFactory) {
    var originalDirectiveFactory = typeof directiveFactory === 'function' ? directiveFactory :
        directiveFactory[directiveFactory.length - 1];
    var factoryStr = originalDirectiveFactory.toString();

    checkPrelimErrors(directiveName,factoryStr);

    var pairs = getKeysAndValues(factoryStr);
    pairs.map(function(pair){customDirectives.push(pair);});

    var matchRestrict = factoryStr.match(RESTRICT_REGEXP);
    var restrict = (matchRestrict && matchRestrict[1]) || 'A';
    var directive = {directiveName: directiveName, restrict: restrict,  require:pairs};
    customDirectives.push(directive);

    return originalDirective.apply(this, arguments);
  };
  return module;
};

},{"./lib/checkPrelimErrors":13,"./lib/ddLib-data":14,"./lib/getKeysAndValues":21,"./lib/search":29,"angular-hint-log":54,"dasherize":31}],4:[function(require,module,exports){
/**
 *@param s: first string to compare
 *@param t: second string to compare
 *
 *@description:
 *Checks to see if two strings are similiar enough to even bother checking the Levenshtein Distance.
 */
module.exports = function(s,t) {
  var strMap = {}, similarities = 0, STRICTNESS = 0.66;
  if(Math.abs(s.length-t.length) > 3) {
    return false;
  }
  s.split('').forEach(function(x){strMap[x] = x;});
  for (var i = t.length - 1; i >= 0; i--) {
    similarities = strMap[t.charAt(i)] ? similarities + 1 : similarities;
  }
  return similarities >= t.length * STRICTNESS;
};

},{}],5:[function(require,module,exports){
var ddLibData = require('./ddLib-data');

/**
 *@param attribute: attribute name as string e.g. 'ng-click', 'width', 'src', etc.
 *@param options: {} options object from beginSearch.
 *
 *@description attribute exsistance in the types of directives/attibutes (html, angular core, and
 * angular custom) and checks the restrict property of values matches its use.
 *
 *@return {} with attribute exsistance and wrong use e.g. restrict property set to elements only.
 **/
module.exports = function(attribute, options) {
  var anyTrue = false,
      wrongUse = '',
      directive,
      restrictProp;

  options.directiveTypes.forEach(function(dirType) {
    var isTag = attribute.charAt(0) === '*';
    var isCustomDir = dirType === 'angular-custom-directives';
    if(!isTag) {
      directive = ddLibData.directiveTypes[dirType].directives[attribute] || '';
      restrictProp = directive.restrict || directive;
      if(restrictProp) {
        if(restrictProp.indexOf('E') > -1 && restrictProp.indexOf('A') < 0) {
          wrongUse = 'element';
        }
        if(restrictProp.indexOf('C') > -1 && restrictProp.indexOf('A') < 0) {
          wrongUse = (wrongUse) ? 'element and class' : 'class';
        }
        anyTrue = anyTrue || true;
      }
    }
    else if(isTag && isCustomDir){
      directive = ddLibData.directiveTypes[dirType].directives[attribute.substring(1)] || '';
      restrictProp = directive.restrict || directive;
      anyTrue = anyTrue || true;
      if(restrictProp && restrictProp.indexOf('A') > -1 && restrictProp.indexOf('E') < 0) {
        wrongUse = 'attribute';
      }
    }
  });
  var typeError = wrongUse? 'wronguse':'' || !anyTrue ? 'nonexsisting' : '' || '';
  return {exsists: anyTrue, wrongUse: wrongUse, typeError: typeError};
};

},{"./ddLib-data":14}],6:[function(require,module,exports){
module.exports = function(info, id, type) {
  var s = info.missing.length === 1 ? ' ' : 's ';
  var waswere = info.missing.length === 1 ? 'was ' : 'were ';
  var missing = '';
  info.missing.forEach(function(str){
    missing += '"'+str+'",';
  });
  missing = '['+missing.substring(0,missing.length-1)+'] ';
  var message = 'Attribute'+s+missing+waswere+'found to be missing in '+type+ ' element'+id+'.';
  return message;
};

},{}],7:[function(require,module,exports){
var isMutExclusiveDir = require('./isMutExclusiveDir');

module.exports = function(info, id, type) {
  var pair = isMutExclusiveDir(info.error);
  var message = 'Angular attributes "'+info.error+'" and "'+pair+'" in '+type+ ' element'+id+
    ' should not be attributes together on the same HTML element';
  return message;
};

},{"./isMutExclusiveDir":26}],8:[function(require,module,exports){
var hintLog = require('angular-hint-log');

module.exports = function(directiveName) {
  var message = 'Directive "'+directiveName+'"" should have proper namespace try adding a prefix'+
    ' and/or using camelcase.';
  var domElement = '<'+directiveName+'> </'+directiveName+'>';
  hintLog.logMessage(message);
};

},{"angular-hint-log":54}],9:[function(require,module,exports){
module.exports = function(info, id, type) {
  var ngDir = 'ng-'+info.error.substring(2);
  var message = 'Use Angular version of "'+info.error+'" in '+type+' element'+id+'. Try: "'+ngDir+'"';
  return message;
};

},{}],10:[function(require,module,exports){
var ddLibData = require('./ddLib-data');

module.exports = function(info, id, type) {
  var message = ddLibData.directiveTypes[info.directiveType].message+type+' element'+id+'. ';
  var error = (info.error.charAt(0) === '*') ? info.error.substring(1): info.error;
  message +='Found incorrect attribute "'+error+'" try "'+info.match+'".';
  return message;
};

},{"./ddLib-data":14}],11:[function(require,module,exports){
var hintLog = require('angular-hint-log');

module.exports = function(directiveName) {
  var message = 'The use of "replace" in directive factories is deprecated,'+
    ' and it was found in "'+directiveName+'".';
  var domElement = '<'+directiveName+'> </'+directiveName+'>';
  hintLog.logMessage(message);
};

},{"angular-hint-log":54}],12:[function(require,module,exports){
var ddLibData = require('./ddLib-data');

module.exports = function(info, id, type) {
  var message = ddLibData.directiveTypes[info.directiveType].message+type+' element'+id+'. ';
  var error = (info.error.charAt(0) === '*') ? info.error.substring(1): info.error;
  var aecmType = (info.wrongUse.indexOf('attribute') > -1)? 'Element' : 'Attribute';
  message += aecmType+' name "'+error+'" is reserved for '+info.wrongUse+' names only.';
  return message;
};

},{"./ddLib-data":14}],13:[function(require,module,exports){
var hasNameSpace = require('./hasNameSpace');
var buildNameSpace = require('./buildNameSpace');
var hasReplaceOption = require('./hasReplaceOption');
var buildReplaceOption = require('./buildReplaceOption');

module.exports = function(dirName, dirFacStr) {
  if (!hasNameSpace(dirName)) {
    buildNameSpace(dirName);
  }
  if (hasReplaceOption(dirFacStr)) {
    buildReplaceOption(dirName);
  }
};

},{"./buildNameSpace":8,"./buildReplaceOption":11,"./hasNameSpace":24,"./hasReplaceOption":25}],14:[function(require,module,exports){
module.exports = {
  directiveTypes : {
    'html-directives': {
      message: 'There was an HTML error in ',
      directives: {
      'abbr' : 'A',
      'accept': 'A',
      'accesskey': 'A',
      'action': 'A',
      'align': 'A',
      'alt': 'A',
      'background': 'A',
      'bgcolor': 'A',
      'border': 'A',
      'cellpadding': 'A',
      'char': 'A',
      'charoff': 'A',
      'charset': 'A',
      'checked': 'A',
      'cite': 'A',
      'class': 'A',
      'classid': 'A',
      'code': 'A',
      'codebase': 'A',
      'color': 'A',
      'cols': 'A',
      'colspan': 'A',
      'content': 'A',
      'data': 'A',
      'defer': 'A',
      'dir': 'A',
      'face': 'A',
      'for': 'A',
      'frame': 'A',
      'frameborder': 'A',
      'headers': 'A',
      'height': 'A',
      'http-equiv': 'A',
      'href': 'A',
      'id': 'A',
      'label': 'A',
      'lang': 'A',
      'language': 'A',
      'link': 'A',
      'marginheight': 'A',
      'marginwidth': 'A',
      'maxlength': 'A',
      'media': 'A',
      'multiple': 'A',
      'name': 'A',
      'object': '!A',
      'onblur': '!A',
      'onchange': '!A',
      'onclick': '!A',
      'onfocus': '!A',
      'onkeydown': '!A',
      'onkeypress': '!A',
      'onkeyup': '!A',
      'onload': '!A',
      'onmousedown': '!A',
      'onmousemove': '!A',
      'onmouseout': '!A',
      'onmouseover': '!A',
      'onmouseup': '!A',
      'onreset': '!A',
      'onselect': '!A',
      'onsubmit': '!A',
      'readonly': 'A',
      'rel': 'A',
      'rev': 'A',
      'role': 'A',
      'rows': 'A',
      'rowspan': 'A',
      'size': 'A',
      'span': 'EA',
      'src': 'A',
      'start': 'A',
      'style': 'A',
      'text': 'A',
      'target': 'A',
      'title': 'A',
      'type': 'A',
      'value': 'A',
      'width': 'A'}
    },
    'angular-default-directives': {
      message: 'There was an AngularJS error in ',
      directives: {
        'count': 'A',
        'min': 'A',
        'max': 'A',
        'ng-app': 'A',
        'ng-bind': 'A',
        'ng-bindhtml': 'A',
        'ng-bindtemplate': 'A',
        'ng-blur': 'A',
        'ng-change': 'A',
        'ng-checked': 'A',
        'ng-class': 'A',
        'ng-classeven': 'A',
        'ng-classodd': 'A',
        'ng-click': 'A',
        'ng-cloak': 'A',
        'ng-controller': 'A',
        'ng-copy': 'A',
        'ng-csp': 'A',
        'ng-cut': 'A',
        'ng-dblclick': 'A',
        'ng-disabled': 'A',
        'ng-dirty': 'A',
        'ng-focus': 'A',
        'ng-form': 'A',
        'ng-hide': 'A',
        'ng-hint': 'A',
        'ng-hint-exclude': 'A',
        'ng-hint-include': 'A',
        'ng-href': 'A',
        'ng-if': 'A',
        'ng-include': 'A',
        'ng-init': 'A',
        'ng-invalid': 'A',
        'ng-keydown': 'A',
        'ng-keypress': 'A',
        'ng-keyup': 'A',
        'ng-list': 'A',
        'ng-maxlength': 'A',
        'ng-minlength': 'A',
        'ng-model': 'A',
        'ng-model-options': 'A',
        'ng-mousedown': 'A',
        'ng-mouseenter': 'A',
        'ng-mouseleave': 'A',
        'ng-mousemove': 'A',
        'ng-mouseover': 'A',
        'ng-mouseup': 'A',
        'ng-nonbindable': 'A',
        'ng-open': 'A',
        'ng-options': 'A',
        'ng-paste': 'A',
        'ng-pattern': 'A',
        'ng-pluralize': 'A',
        'ng-pristine': 'A',
        'ng-readonly': 'A',
        'ng-repeat': 'A',
        'ng-required': 'A',
        'ng-selected': 'A',
        'ng-show': 'A',
        'ng-src': 'A',
        'ng-srcset': 'A',
        'ng-style': 'A',
        'ng-submit': 'A',
        'ng-switch': 'A',
        'ng-transclude': 'A',
        'ng-true-value': 'A',
        'ng-trim': 'A',
        'ng-false-value': 'A',
        'ng-value': 'A',
        'ng-valid': 'A',
        'ng-view': 'A',
        'required': 'A',
        'when': 'A'
      }
    },
    'angular-custom-directives': {
      message: 'There was an AngularJS error in ',
      directives: {

      }
    }
  }
};

},{}],15:[function(require,module,exports){
var areSimilarEnough = require('./areSimilarEnough');
var levenshteinDistance = require('./levenshtein');

/**
 *@param directiveTypeData: {} with list of directives/attributes and
 *their respective restrict properties.
 *@param attribute: attribute name as string e.g. 'ng-click', 'width', 'src', etc.
 *
 *@return {} with Levenshtein Distance and name of the closest match to given attribute.
 **/
module.exports = function(directiveTypeData, attribute) {
  if(typeof attribute !== 'string') {
    throw new Error('Function must be passed a string as second parameter.');
  }
  if((directiveTypeData === null || directiveTypeData === undefined) ||
    typeof directiveTypeData !== 'object') {
    throw new Error('Function must be passed a defined object as first parameter.');
  }
  var min_levDist = Infinity,
      closestMatch = '';

  for(var directive in directiveTypeData){
    if(areSimilarEnough(attribute,directive)) {
      var currentlevDist = levenshteinDistance(attribute, directive);
      closestMatch = (currentlevDist < min_levDist)? directive : closestMatch;
      min_levDist = (currentlevDist < min_levDist)? currentlevDist : min_levDist;
    }
  }
  return {min_levDist: min_levDist, match: closestMatch};
};

},{"./areSimilarEnough":4,"./levenshtein":27}],16:[function(require,module,exports){

var getFailedAttributesOfElement = require('./getFailedAttributesOfElement');

module.exports = function(scopeElements, options) {
  return scopeElements.map(getFailedAttributesOfElement.bind(null, options))
      .filter(function(x) {return x;});
};

},{"./getFailedAttributesOfElement":20}],17:[function(require,module,exports){
var ddLibData = require('./ddLib-data');

module.exports = function(dirName, attributes) {
  attributes = attributes.map(function(x){return x.nodeName;});
  var directive = ddLibData.directiveTypes['angular-custom-directives'].directives[dirName];
  var missing = [];
  if (directive && directive.require) {
    for (var i = 0; i < directive.require.length; i++) {
      if (attributes.indexOf(directive.require[i].directiveName) < 0) {
        missing.push(directive.require[i].directiveName);
      }
    }
  }
  return missing;
};

},{"./ddLib-data":14}],18:[function(require,module,exports){
var hintLog = require('angular-hint-log');

var build = {
  wronguse: require('./buildWrongUse'),
  nonexsisting: require('./buildNonExsisting'),
  missingrequired: require('./buildMissingRequired'),
  ngevent: require('./buildNgEvent'),
  mutuallyexclusive: require('./buildMutuallyExclusive')
};

/**
 *@param failedElements: [] of {}s of all failed elements with their failed attributes and closest
 *matches or restrict properties
 *
 *@return [] of failed messages.
 **/
module.exports = function(failedElements) {
  var messages = [];
  failedElements.forEach(function(obj) {
    obj.data.forEach(function(info) {
      var id = (obj.domElement.id) ? ' with id: #' + obj.domElement.id : '';
      var type = obj.domElement.nodeName;
      var message = build[info.typeError](info, id, type);
      hintLog.logMessage(message);
      messages.push(message);
    });
  });
  return messages;
};

},{"./buildMissingRequired":6,"./buildMutuallyExclusive":7,"./buildNgEvent":9,"./buildNonExsisting":10,"./buildWrongUse":12,"angular-hint-log":54}],19:[function(require,module,exports){
var normalizeAttribute = require('./normalizeAttribute');
var ddLibData = require('./ddLib-data');
var isMutExclusiveDir = require('./isMutExclusiveDir');
var hasMutExclusivePair = require('./hasMutExclusivePair');
var attributeExsistsInTypes = require('./attributeExsistsInTypes');
var getSuggestions = require('./getSuggestions');

/**
 *@param attributes: [] of attributes from element (includes tag name of element, e.g. DIV, P, etc.)
 *@param options: {} options object from beginSearch
 *
 *@return [] of failedAttributes with their respective suggestions and directiveTypes
 **/
module.exports = function(attributes, options) {
  var failedAttrs = [], mutExPairFound = false;
  for (var i = 0; i < attributes.length; i++) {
    var attr = normalizeAttribute(attributes[i].nodeName);
    var dirVal = ddLibData.directiveTypes['html-directives'].directives[attr] || '';
    if (dirVal.indexOf('!') > -1) {
      failedAttrs.push({
        error: attr,
        directiveType: 'html-directives',
        typeError: 'ngevent'
      });
      continue;
    }
    if (!mutExPairFound && isMutExclusiveDir(attr) && hasMutExclusivePair(attr, attributes)) {
      failedAttrs.push({
        error: attr,
        directiveType: 'angular-default-directives',
        typeError: 'mutuallyexclusive'
      });
      mutExPairFound = true;
      continue;
    }
    var result = attributeExsistsInTypes(attr,options);
    var suggestion = result.typeError === 'nonexsisting' ?
        getSuggestions(attr, options) : {match: ''};

    if (result.typeError) {
      failedAttrs.push({
        match: suggestion.match || '',
        wrongUse: result.wrongUse || '',
        error: attr,
        directiveType: suggestion.directiveType || 'angular-custom-directives',
        typeError: result.typeError
      });
    }
  }
  return failedAttrs;
};

},{"./attributeExsistsInTypes":5,"./ddLib-data":14,"./getSuggestions":22,"./hasMutExclusivePair":23,"./isMutExclusiveDir":26,"./normalizeAttribute":28}],20:[function(require,module,exports){
var getFailedAttributes = require('./getFailedAttributes');
var findMissingAttrs = require('./findMissingAttrs');


/**
 *@description
 *Adds element tag name (DIV, P, SPAN) to list of attributes with '*' prepended
 *for identification later.
 *
 *@param options: {} options object from beginSearch
 *@param element: HTML element to check attributes of
 *
 *@return {} of html element and [] of failed attributes
 **/
module.exports = function(options, element) {
  if(element.attributes.length) {
    var eleName = element.nodeName.toLowerCase();
    var eleAttrs = Array.prototype.slice.call(element.attributes);
    eleAttrs.push({
      nodeName: '*'+eleName
    });
    var failedAttrs = getFailedAttributes(eleAttrs, options);
    var missingRequired = findMissingAttrs(eleName, eleAttrs);
    if(failedAttrs.length || missingRequired.length) {
      if(missingRequired.length) {
        failedAttrs.push({
          directiveType: 'angular-custom-directive',
          missing: missingRequired,
          typeError: 'missingrequired'
        });
      }
      return {
        domElement: element,
        data: failedAttrs
      };
    }
  }
};

},{"./findMissingAttrs":17,"./getFailedAttributes":19}],21:[function(require,module,exports){
module.exports = function(str) {
  var customDirectives = [], pairs = [];
  var matchScope = str.replace(/\n/g,'').match(/scope\s*:\s*{\s*[^}]*['"]\s*}/);
  if (matchScope) {
    matchScope[0].match(/\w+\s*:\s*['"][a-zA-Z=@&]+['"]/g).map(function(str){
      var temp = str.match(/(\w+)\s*:\s*['"](.+)['"]/);
      pairs.push({key:temp[1],value:temp[2]});
    });
    pairs.forEach(function(pair){
      var name = (['=', '@', '&'].indexOf(pair.value) !== -1)? pair.key : pair.value.substring(1);
      customDirectives.push({directiveName: name , restrict:'A'});
    });
  }
  return customDirectives;
};

},{}],22:[function(require,module,exports){
var ddLibData = require('./ddLib-data');
var findClosestMatchIn = require('./findClosestMatchIn');

/**
 *@param attribute: attribute name as string e.g. 'ng-click', 'width', 'src', etc.
 *@param options: {} options object from beginSearch.
 *
 *@return {} with closest match to attribute and the directive type it corresponds to.
 **/
module.exports = function(attribute, options) {
  var min_levDist = Infinity,
      match = '',
      dirType = '';

  options.directiveTypes.forEach(function(directiveType) {
    var isTag = attribute.charAt(0) === '*';
    var isCustomDir = directiveType === 'angular-custom-directives';
    if (!isTag || (isTag && isCustomDir)) {
      var directiveTypeData = ddLibData.directiveTypes[directiveType].directives;
      var tempMatch = findClosestMatchIn(directiveTypeData, attribute);
      if (tempMatch.min_levDist < options.tolerance && tempMatch.min_levDist < min_levDist) {
        match = tempMatch.match;
        dirType = directiveType;
        min_levDist = tempMatch.min_levDist;
      }
    }
  });
  return {
    match: match,
    directiveType: dirType
  };
};

},{"./ddLib-data":14,"./findClosestMatchIn":15}],23:[function(require,module,exports){
var isMutExclusiveDir = require('./isMutExclusiveDir');

module.exports = function(attr, attributes) {
  var pair = isMutExclusiveDir(attr);

  return attributes.some(function(otherAttr) {
    return otherAttr.nodeName === pair;
  });
};

},{"./isMutExclusiveDir":26}],24:[function(require,module,exports){
module.exports = function(str) {
  return str.toLowerCase() !== str;
};

},{}],25:[function(require,module,exports){
module.exports = function(facStr) {
  return facStr.match(/replace\s*:/);
};

},{}],26:[function(require,module,exports){
module.exports = function (dirName) {
  var exclusiveDirHash = {
    'ng-show' : 'ng-hide',
    'ng-hide' : 'ng-show',
    'ng-switch-when' : 'ng-switch-default',
    'ng-switch-default' : 'ng-switch-when',
  };
  return exclusiveDirHash[dirName];
};

},{}],27:[function(require,module,exports){
/**
 *@param s: first string to compare for Levenshtein Distance.
 *@param t: second string to compare for Levenshtein Distance.
 *
 *@description
 *Calculates the minimum number of changes (insertion, deletion, transposition) to get from s to t.
 *
 *credit: http://stackoverflow.com/questions/11919065/sort-an-array-by-the-levenshtein-distance-with-best-performance-in-javascript
 *http://www.merriampark.com/ld.htm, http://www.mgilleland.com/ld/ldjavascript.htm, Damerau–Levenshtein distance (Wikipedia)
 **/
module.exports = function(s, t) {
  if(typeof s !== 'string' || typeof t !== 'string') {
    throw new Error('Function must be passed two strings, given: '+typeof s+' and '+typeof t+'.');
  }
  var d = [];
  var n = s.length;
  var m = t.length;

  if (n === 0) {return m;}
  if (m === 0) {return n;}

  for (var ii = n; ii >= 0; ii--) { d[ii] = []; }
  for (var ii = n; ii >= 0; ii--) { d[ii][0] = ii; }
  for (var jj = m; jj >= 0; jj--) { d[0][jj] = jj; }
  for (var i = 1; i <= n; i++) {
    var s_i = s.charAt(i - 1);

    for (var j = 1; j <= m; j++) {
      if (i == j && d[i][j] > 4) return n;
      var t_j = t.charAt(j - 1);
      var cost = (s_i == t_j) ? 0 : 1;
      var mi = d[i - 1][j] + 1;
      var b = d[i][j - 1] + 1;
      var c = d[i - 1][j - 1] + cost;
      if (b < mi) mi = b;
      if (c < mi) mi = c;
      d[i][j] = mi;
      if (i > 1 && j > 1 && s_i == t.charAt(j - 2) && s.charAt(i - 2) == t_j) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
      }
    }
  }
  return d[n][m];
};

},{}],28:[function(require,module,exports){
/**
 *@param attribute: attribute name before normalization as string
 * e.g. 'data-ng-click', 'width', 'x:ng:src', etc.
 *
 *@return normalized attribute name
 **/
module.exports = function(attribute) {
  return attribute.replace(/^(?:data|x)[-_:]/,'').replace(/[:_]/g,'-');
};

},{}],29:[function(require,module,exports){

var formatResults = require('./formatResults');
var findFailedElements = require('./findFailedElements');
var setCustomDirectives = require('./setCustomDirectives');
var defaultTypes = [
  'html-directives',
  'angular-default-directives',
  'angular-custom-directives'
];


/**
 *
 *@param scopeElements: [] of HTML elements to be checked for incorrect attributes
 *@param customDirectives: [] of custom directive objects from $compile decorator
 *@param options: {} of options for app to run with:
 *    options.tolerance: Integer, maximum Levenshtein Distance to be allowed for misspellings
 *    options.directiveTypes: [] of which type of directives/attributes to search through
 **/
module.exports = function(scopeElements, customDirectives, options) {
  if(!Array.isArray(scopeElements)) {
    throw new Error('Function search must be passed an array.');
  }
  options = options || {};
  options.directiveTypes = options.directiveTypes || defaultTypes;
  options.tolerance = options.tolerance || 4;
  if(customDirectives && customDirectives.length){
    setCustomDirectives(customDirectives);
  }
  var failedElements = findFailedElements(scopeElements, options);
  var messages = formatResults(failedElements);

  return messages;
};

},{"./findFailedElements":16,"./formatResults":18,"./setCustomDirectives":30}],30:[function(require,module,exports){
var ddLibData = require('../lib/ddLib-data');

module.exports = function(customDirectives) {
  customDirectives.forEach(function(directive) {
    var directiveName = directive.directiveName.replace(/([A-Z])/g, '-$1').toLowerCase();
    ddLibData.directiveTypes['angular-custom-directives']
      .directives[directiveName] = directive;
  });
};

},{"../lib/ddLib-data":14}],31:[function(require,module,exports){
'use strict';

var isArray = Array.isArray || function (obj) {
  return Object.prototype.toString.call(obj) === '[object Array]';
};

var isDate = function (obj) {
  return Object.prototype.toString.call(obj) === '[object Date]';
};

var isRegex = function (obj) {
  return Object.prototype.toString.call(obj) === '[object RegExp]';
};

var has = Object.prototype.hasOwnProperty;
var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    if (has.call(obj, key)) {
      keys.push(key);
    }
  }
  return keys;
};

function dashCase(str) {
  return str.replace(/([A-Z])/g, function ($1) {
    return '-' + $1.toLowerCase();
  });
}

function map(xs, f) {
  if (xs.map) {
    return xs.map(f);
  }
  var res = [];
  for (var i = 0; i < xs.length; i++) {
    res.push(f(xs[i], i));
  }
  return res;
}

function reduce(xs, f, acc) {
  if (xs.reduce) {
    return xs.reduce(f, acc);
  }
  for (var i = 0; i < xs.length; i++) {
    acc = f(acc, xs[i], i);
  }
  return acc;
}

function walk(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  if (isDate(obj) || isRegex(obj)) {
    return obj;
  }
  if (isArray(obj)) {
    return map(obj, walk);
  }
  return reduce(objectKeys(obj), function (acc, key) {
    var camel = dashCase(key);
    acc[camel] = walk(obj[key]);
    return acc;
  }, {});
}

module.exports = function (obj) {
  if (typeof obj === 'string') {
    return dashCase(obj);
  }
  return walk(obj);
};

},{}],32:[function(require,module,exports){
'use strict';

var domInterceptor = require('dom-interceptor');
var hintLog = angular.hint = require('angular-hint-log');
domInterceptor.enableLineNumbers(3);

var nameToConstructorMappings = {};

/**
* Decorates $controller with a patching function to
* throw an error if DOM APIs are manipulated from
* within an Angular controller
*/
angular.module('ngHintDom', []).
  config(function ($provide) {
    $provide.decorator('$controller', function($delegate, $injector) {

      var patchedServices = {};

      return function(ctrl, locals) {

        if(typeof ctrl == 'string') {
          ctrl = nameToConstructorMappings[ctrl];
        }

        var dependencies = $injector.annotate(ctrl);

        // patch methods on $scope
        locals = locals || {};
        dependencies.forEach(function (dep) {
          if (typeof dep === 'string' && !locals[dep]) {
            locals[dep] = patchedServices[dep] ||
            (patchedServices[dep] = patchService($injector.get('$timeout')));
          }
        });

        function disallowedContext(fn) {
          return function () {
            domInterceptor.addManipulationListener(function(message) {
              hintLog.logMessage(message);
            });
            var ret = fn.apply(this, arguments);
            domInterceptor.removeManipulationListener();
            return ret;
          }
        }

        function patchArguments (fn) {
          return function () {
            for (var i = 0; i < arguments.length; i++) {
              if (typeof arguments[i] === 'function') {
                arguments[i] = disallowedContext(arguments[i]);
              }
            }
            return fn.apply(this, arguments);
          }
        }

        function patchService (obj) {
          if (typeof obj === 'function') {
            return patchArguments(obj);
          } else if (typeof obj === 'object') {
            return Object.keys(obj).reduce(function (obj, prop) {
              return obj[prop] = patchService(obj[prop]), obj;
            }, obj);
          }
          return obj;
        }

        // body of controller
        domInterceptor.addManipulationListener(function(message) {
          hintLog.logMessage(message);
        });
        var ctrlInstance = $delegate.apply(this, [ctrl, locals]);
        domInterceptor.removeManipulationListener();

        // controller.test
        Object.keys(ctrlInstance).forEach(function (prop) {
          if (prop[0] !== '$' && typeof ctrlInstance[prop] === 'function') {
            ctrlInstance[prop] = disallowedContext(ctrlInstance[prop]);
          }
        });

        if(locals.$scope) {
          Object.keys(locals.$scope).forEach(function (prop) {
            if([prop][0] !== '$' && typeof locals.$scope[prop] === 'function') {
              locals.$scope[prop] = disallowedContext(locals.$scope[prop]);
            }
          });
        }

        return ctrlInstance;
      };
    });
  });

var originalAngularModule = angular.module;
angular.module = function() {
  var module = originalAngularModule.apply(this, arguments);
  var originalController = module.controller;
  module.controller = function(controllerName, controllerConstructor) {
    nameToConstructorMappings[controllerName] = controllerConstructor;
    return originalController.apply(this, arguments);
  };
  return module;
};

},{"angular-hint-log":54,"dom-interceptor":33}],33:[function(require,module,exports){
'use strict'
/**
* Initializes the  listener to a function that is provided.
* The Element, Node, and Document prototypes are then patched to call
* this listener when DOM APIs are accessed.
**/
function addManipulationListener(newListener) {
  listener = _listener;
  savedListener = newListener;
  patchOnePrototype(Element, 'Element');
  patchOnePrototype(Node, 'Node');
  patchOnePrototype(Document, 'Document');
  listener = savedListener;
};

/**
* The interceptor should give a helpful message when manipulation is detected.
*/
var explanation = 'Detected Manipulation of DOM API: ';

/**
* The DOM-interceptor should not throw errors because
* of its own access to the DOM. Within the interceptor
* the listener should have no behavior.
*/
var _listener = function() {};
var listener = savedListener;
var savedListener = function(message) {};

/**
* The listener should include the line where the users program gives an error
* if line numbers are enabled. Enabling line numbers requires giving a valid
* line of the stack trace in which the line number should appear. This is because
* using an arbitrary line of the stacktrace such as line might return the line within
* the interceptor where the listener was called.
*/
var stackTraceLine = undefined;
function enableLineNumbers(stackTraceLocation) {
  if(typeof stackTraceLocation === 'number' && !isNaN(stackTraceLocation)) {
    stackTraceLine = stackTraceLocation;
  } else {
    throw new Error('Enabling line numbers requires an integer parameter of the stack trace line '
      + 'that should be given. Got: ' + stackTraceLocation);
  }
}

/**
* Finds the line number where access of a DOM API was detected
*/
function findLineNumber() {
  var e = new Error();
  //Find the line in the user's program rather than in this service
  var lineNum = e.stack ? e.stack.split('\n')[stackTraceLine] : '(line number unavailable in Safari)';
  lineNum = lineNum.split('<anonymous> ')[1] || lineNum;
  return lineNum;
};

/**
* Object to preserve all the original properties
* that will be restored after patching.
**/
var originalProperties = {};

/**
* Helper function for patching one prototype.
* Saves the unaltered state of the prototype using collectUnalteredPrototypeProperties()
* and then patches the given prototype with a call to the listener.
*/
function patchOnePrototype(type, typeName) {
  collectUnalteredPrototypeProperties(type, typeName);
  listener = _listener;
  if (!type || !type.prototype) {
    throw new Error('collectPrototypeProperties() needs a .prototype to collect properties from. '
      + type + '.prototype is undefined.');
  }
  var objectProperties = Object.getOwnPropertyNames(type.prototype);
  objectProperties.forEach(function(prop) {
    //Access of some prototype values may throw an error
    var desc = undefined;
    try {
      desc = Object.getOwnPropertyDescriptor(type.prototype, prop);
    }
    catch(e) {}
    if (desc) {
      if (desc.configurable) {
        if (desc.value) {
          if (typeof desc.value === 'function') {
            var originalValue = desc.value;
            desc.value = function () {
              listener(explanation + prop + (stackTraceLine ? ' ' + findLineNumber() : ''));
              return originalValue.apply(this, arguments);
            };
          }
        }
        Object.defineProperty(type.prototype, prop, desc);
      } else if (desc.writable) {
          try {
            var original = type.prototype[prop];
            type.prototype[prop] = function () {
              listener(explanation + prop + (stackTraceLine ? ' ' + findLineNumber() : ''));
              return original.apply(this, arguments);
            };
          }
          catch (e) {}
        }
    }
  });
  listener = savedListener;
};

/**
* Helper method to collect all properties of a given prototype.
* When patching is removed, all prototype properties
* are set back to these original values
**/
function collectUnalteredPrototypeProperties(type, typeName) {
  listener = _listener;
  if(!type || !type.prototype) {
    throw new Error('collectUnalteredPrototypeProperties() needs a .prototype to collect properties' +
      ' from. ' + type + '.prototype is undefined.');
  } else if(!typeName) {
    throw new Error('typeName is required to save properties, got: ' + typeName);
  }
  var objectProperties = {};
  var objectPropertyNames = Object.getOwnPropertyNames(type.prototype);
  objectPropertyNames.forEach(function(prop) {
    //Access of some prototype values may throw an error
    try {
      objectProperties[prop] = type.prototype[prop];
    } catch(e) {}
  });
  listener = savedListener;
  originalProperties[typeName] = objectProperties;
  return objectProperties;
};

/**
* Controls the unpatching process by unpatching the
* prototypes as well as disabling the patching of individual
* HTML elements and returning those patched elements to their
* original state.
**/
function removeManipulationListener() {
  listener = _listener;
  unpatchOnePrototype(Element, 'Element');
  unpatchOnePrototype(Node, 'Node');
  unpatchOnePrototype(Document, 'Document');
  listener = savedListener;
};

/**
* Helper function to unpatch one prototype.
* Sets all properties of the given type back to the
* original values that were collected.
**/
function unpatchOnePrototype(type, typeName) {
  listener = _listener;
  if(!typeName) {
    throw new Error('typeName must be the name used to save prototype properties. Got: ' + typeName);
  }
  var objectProperties = Object.getOwnPropertyNames(type.prototype);
  objectProperties.forEach(function(prop) {
    //Access of some prototype values may throw an error
    try{
    var alteredElement = type.prototype[prop];
      if(typeof alteredElement === 'function') {
        type.prototype[prop] = originalProperties[typeName][prop];
      }
    } catch(e) {}
  });
  listener = savedListener;
};

module.exports.addManipulationListener = addManipulationListener;
module.exports.removeManipulationListener = removeManipulationListener;
module.exports.patchOnePrototype = patchOnePrototype;
module.exports.unpatchOnePrototype = unpatchOnePrototype;
module.exports.enableLineNumbers = enableLineNumbers;


},{}],34:[function(require,module,exports){
'use strict';

var hintLog = angular.hint = require('angular-hint-log');
var ngEventDirectives = require('./lib/getEventDirectives')();

var getEventAttribute = require('./lib/getEventAttribute');
var getFunctionNames = require('./lib/getFunctionNames');
var formatResults = require('./lib/formatResults');

angular.module('ngHintEvents',[])
  .config(['$provide',function($provide) {

    for(var directive in ngEventDirectives) {

      var dirName = ngEventDirectives[directive]+'Directive';

      $provide.decorator(dirName, ['$delegate', '$timeout', '$parse',
        function($delegate, $timeout, $parse) {

          var original = $delegate[0].compile, falseBinds = [], messages = [];

          $delegate[0].compile = function(element, attrs, transclude) {
            var eventAttrName = getEventAttribute(attrs.$attr);
            var fn = $parse(attrs[eventAttrName]);
            var messages = [];
            return function ngEventHandler(scope, element, attrs) {
              for(var attr in attrs.$attr) {
                var boundFuncs = getFunctionNames(attrs[attr]);
                boundFuncs.forEach(function(boundFn) {
                  if(ngEventDirectives[attr] && !(boundFn in scope)) {
                    messages.push({
                      scope: scope,
                      element:element,
                      attrs: attrs,
                      boundFunc: boundFn
                    });
                  }
                });
              }
              element.on(eventAttrName.substring(2).toLowerCase(), function(event) {
                scope.$apply(function() {
                  fn(scope, {$event:event});
                });
              });
              formatResults(messages);
            };
          };
          return $delegate;
      }]);
    }
  }]);
},{"./lib/formatResults":37,"./lib/getEventAttribute":38,"./lib/getEventDirectives":39,"./lib/getFunctionNames":40,"angular-hint-log":54}],35:[function(require,module,exports){
var getValidProps = require('./getValidProps');
var getSuggestion = require('./getSuggestion');

module.exports = function addSuggestions(messages) {
  messages.forEach(function(messageObj) {
    var props = getValidProps(messageObj.scope);
    var suggestion = getSuggestion(messageObj.boundFunc, props);
    messageObj['match'] = suggestion;
  });
  return messages;
};

},{"./getSuggestion":41,"./getValidProps":42}],36:[function(require,module,exports){
module.exports = function areSimilarEnough(s,t) {
  var strMap = {}, similarities = 0, STRICTNESS = .66;
  if(Math.abs(s.length-t.length) > 3) {
    return false;
  }
  s.split('').forEach(function(x){strMap[x] = x;});
  for (var i = t.length - 1; i >= 0; i--) {
    similarities = strMap[t.charAt(i)] ? similarities + 1 : similarities;
  }
  return similarities >= t.length * STRICTNESS;
};

},{}],37:[function(require,module,exports){
var hintLog = require('angular-hint-log');
var addSuggestions = require('./addSuggestions');

module.exports = function formatResults(messages) {
  messages = addSuggestions(messages);
  if(messages.length) {
    messages.forEach(function(obj) {
      var id = (obj.element[0].id) ? ' with id: #'+obj.element[0].id : '';
      var type = obj.element[0].nodeName;
      var suggestion = obj.match ? ' (Try "'+obj.match+'")': '';
      var message = 'Variable "'+obj.boundFunc+'" called on '+type+' element'+id+' does not '+
      'exist in that scope.'+suggestion+' Event directive found on ' + obj.element[0] + ' in ' +
      obj.scope + ' scope.';
      hintLog.logMessage(message);
    });
  }
};

},{"./addSuggestions":35,"angular-hint-log":54}],38:[function(require,module,exports){
var ngEventDirectives = require('./getEventDirectives')();

module.exports = function getEventAttribute(attrs) {
  for(var attr in attrs) {
    if(ngEventDirectives[attr]) {
      return attr;
    }
  }
};

},{"./getEventDirectives":39}],39:[function(require,module,exports){
module.exports = function getEventDirectives() {
  var list = 'click dblclick mousedown mouseup mouseover mouseout mousemove mouseenter mouseleave keydown keyup keypress submit focus blur copy cut paste'.split(' ');
  var eventDirHash = {};
  list.map(function(x){
    var name = 'ng'+x.charAt(0).toUpperCase()+x.substring(1);
    eventDirHash[name]=name;
  });
  return eventDirHash;
};

},{}],40:[function(require,module,exports){
module.exports = function getFunctionNames(str) {
  var results = str.replace(/\s+/g,'').split(/[\+\-\/\|\<\>\^=&!%~]/g).map(function(x){
    if(isNaN(+x)) {
      if(x.match(/\w+\(.*\)$/)){
        return x.substring(0,x.indexOf('('));
      }
      return x;
    }
  }).filter(function(x){return x;});
  return results;
};

},{}],41:[function(require,module,exports){
var areSimilarEnough = require('./areSimilarEnough');
var levenshteinDistance = require('./levenshtein');

module.exports = function getSuggestion(original, props) {
  var min_levDist = Infinity, closestMatch = '';
  for(var i in props) {
    var prop = props[i];
    if(areSimilarEnough(original, prop)) {
      var currentlevDist = levenshteinDistance(original, prop);
      var closestMatch = (currentlevDist < min_levDist)? prop : closestMatch;
      var min_levDist = (currentlevDist < min_levDist)? currentlevDist : min_levDist;
    }
  }
  return closestMatch;
};

},{"./areSimilarEnough":36,"./levenshtein":43}],42:[function(require,module,exports){
module.exports = function getValidProps(obj) {
  var props = [];
  for(var prop in obj) {
    if (prop.charAt(0) != '$' && typeof obj[prop] == 'function') {
      props.push(prop);
    }
  }
  return props;
};

},{}],43:[function(require,module,exports){
module.exports = function levenshteinDistance(s, t) {
    if(typeof s !== 'string' || typeof t !== 'string') {
      throw new Error('Function must be passed two strings, given: '+typeof s+' and '+typeof t+'.');
    }
    var d = [];
    var n = s.length;
    var m = t.length;

    if (n == 0) return m;
    if (m == 0) return n;

    for (var i = n; i >= 0; i--) d[i] = [];
    for (var i = n; i >= 0; i--) d[i][0] = i;
    for (var j = m; j >= 0; j--) d[0][j] = j;
    for (var i = 1; i <= n; i++) {
        var s_i = s.charAt(i - 1);

        for (var j = 1; j <= m; j++) {
            if (i == j && d[i][j] > 4) return n;
            var t_j = t.charAt(j - 1);
            var cost = (s_i == t_j) ? 0 : 1;
            var mi = d[i - 1][j] + 1;
            var b = d[i][j - 1] + 1;
            var c = d[i - 1][j - 1] + cost;
            if (b < mi) mi = b;
            if (c < mi) mi = c;
            d[i][j] = mi;
            if (i > 1 && j > 1 && s_i == t.charAt(j - 2) && s.charAt(i - 2) == t_j) {
                d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
            }
        }
    }
    return d[n][m];
};

},{}],44:[function(require,module,exports){
'use strict';

var getAllParts = require('./lib/getAllParts');
var buildMessage = require('./lib/buildMessage');

angular.module('ngHintInterpolation', [])
  .config(['$provide', function($provide) {
    var ngHintInterpMessages = [];
    $provide.decorator('$interpolate', ['$delegate', '$timeout', function($delegate, $timeout) {
      var interpolateWrapper = function() {
        var interpolationFn = $delegate.apply(this, arguments);
        if(interpolationFn) {
          var parts = getAllParts(arguments[0],$delegate.startSymbol(),$delegate.endSymbol());
          var temp = interpolationFnWrap(interpolationFn,arguments, parts);
          return temp;
        }
      };
      var interpolationFnWrap = function(interpolationFn, interpolationArgs, allParts) {
        return function(){
          var result = interpolationFn.apply(this, arguments);
          buildMessage(allParts, interpolationArgs[0].trim(), arguments[0], $timeout);
          return result;
        };
      };
      angular.extend(interpolateWrapper,$delegate);
      return interpolateWrapper;
    }]);
  }]);

},{"./lib/buildMessage":46,"./lib/getAllParts":48}],45:[function(require,module,exports){
module.exports = function(s,t) {
  var strMap = {}, similarities = 0, STRICTNESS = 0.66;
  if(Math.abs(s.length-t.length) > 3) {
    return false;
  }
  s.split('').forEach(function(x){strMap[x] = x;});
  for (var i = t.length - 1; i >= 0; i--) {
    similarities = strMap[t.charAt(i)] ? similarities + 1 : similarities;
  }
  return similarities >= t.length * STRICTNESS;
};

},{}],46:[function(require,module,exports){
var hintLog = require('angular-hint-log');

var partsEvaluate = require('./partsEvaluate');

module.exports = function(allParts, originalInterpolation, scope, $timeout) {
  var message = partsEvaluate(allParts, originalInterpolation, scope);
  if(message) {
    hintLog.logMessage(message);
  }
};

},{"./partsEvaluate":53,"angular-hint-log":54}],47:[function(require,module,exports){
module.exports = function(parts, concatLength) {
  var total = '';
  for(var i = 0; i <= concatLength; i++) {
    var period = (i===0) ? '' : '.';
    total+=period+parts[i].trim();
  }
  return total;
};

},{}],48:[function(require,module,exports){
var getInterpolation = require('./getInterpolation');
var getOperands = require('./getOperands');
var concatParts = require('./concatParts');

module.exports = function(text, startSym, endSym) {
  if(text.indexOf(startSym) < 0 || text.indexOf(endSym) < 0) {
    throw new Error('Missing start or end symbol in interpolation. Start symbol: "'+startSym+
      '" End symbol: "'+endSym+'"');
  }
  var comboParts = [];
  var interpolation = getInterpolation(text, startSym, endSym);
  var operands = getOperands(interpolation);
  operands.forEach(function(operand) {
    var opParts =  operand.split('.');
    for(var i = 0; i < opParts.length; i++) {
      var result = concatParts(opParts,i);
      if(result && comboParts.indexOf(result) < 0 && isNaN(+result)){
        comboParts.push(result);
      }
    }
  });
  return comboParts;
};

},{"./concatParts":47,"./getInterpolation":49,"./getOperands":50}],49:[function(require,module,exports){
module.exports = function(text, startSym, endSym) {
  var startInd = text.indexOf(startSym) + startSym.length;
  var endInd = text.indexOf(endSym);
  return text.substring(startInd, endInd);
};

},{}],50:[function(require,module,exports){
module.exports = function(str) {
  return str.split(/[\+\-\/\|<\>\^=&!%~]/g);
};

},{}],51:[function(require,module,exports){
var areSimilarEnough = require('./areSimilarEnough');
var levenshtein = require('./levenshtein');

module.exports = function (part, scope) {
  var min_levDist = Infinity, closestMatch = '';
  for(var i in scope) {
    if(areSimilarEnough(part, i)) {
      var currentlevDist = levenshtein(part, i);
      closestMatch = (currentlevDist < min_levDist)? i : closestMatch;
      min_levDist = (currentlevDist < min_levDist)? currentlevDist : min_levDist;
    }
  }
  return closestMatch;
};

},{"./areSimilarEnough":45,"./levenshtein":52}],52:[function(require,module,exports){
module.exports = function(s, t) {
  if(typeof s !== 'string' || typeof t !== 'string') {
    throw new Error('Function must be passed two strings, given: '+typeof s+' and '+typeof t+'.');
  }
  var d = [];
  var n = s.length;
  var m = t.length;

  if (n === 0) {return m;}
  if (m === 0) {return n;}

  for (var ii = n; ii >= 0; ii--) { d[ii] = []; }
  for (var ii = n; ii >= 0; ii--) { d[ii][0] = ii; }
  for (var jj = m; jj >= 0; jj--) { d[0][jj] = jj; }
  for (var i = 1; i <= n; i++) {
    var s_i = s.charAt(i - 1);

    for (var j = 1; j <= m; j++) {
      if (i == j && d[i][j] > 4) return n;
      var t_j = t.charAt(j - 1);
      var cost = (s_i == t_j) ? 0 : 1;
      var mi = d[i - 1][j] + 1;
      var b = d[i][j - 1] + 1;
      var c = d[i - 1][j - 1] + cost;
      if (b < mi) mi = b;
      if (c < mi) mi = c;
      d[i][j] = mi;
      if (i > 1 && j > 1 && s_i == t.charAt(j - 2) && s.charAt(i - 2) == t_j) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
      }
    }
  }
  return d[n][m];
};

},{}],53:[function(require,module,exports){
var getSuggestion = require('./getSuggestion');

module.exports = function(allParts, originalInterpolation, scope) {
  var message, found = false;
  allParts.forEach(function(part) {
    if(!scope.$eval(part) && !found){
      found = true;
      if(part.lastIndexOf('.') == -1) {
        var tempScope = scope;
        var tempPart = part;
      } else {
        var tempScope = scope.$eval(part.substring(0, part.lastIndexOf('.')));
        var tempPart = part.substring(part.lastIndexOf('.') + 1);
      }
      var suggestion = getSuggestion(tempPart, tempScope);
      suggestion = (suggestion) ? ' Try: "'+suggestion+'"' : '';
      message = '"'+part+'" was found to be undefined in "'+originalInterpolation+'".'+ suggestion;
    }
  });
  return message;
};

},{"./getSuggestion":51}],54:[function(require,module,exports){
var queuedMessages = [];
function logMessage(message) {
  queuedMessages.push(message);
  module.exports.onMessage(message);
};

function flush() {
  var flushMessages = queuedMessages;
  queuedMessages = [];
  return flushMessages;
};

module.exports.onMessage = function(message) {
	console.log(message);
	flush();
};
module.exports.logMessage = logMessage;
module.exports.flush = flush;
},{}],55:[function(require,module,exports){
'use strict';


var hintLog = angular.hint = require('angular-hint-log');
var storeDependencies = require('./lib/storeDependencies');
var getModule = require('./lib/getModule');
var start = require('./lib/start');
var modData = require('./lib/moduleData');

var originalAngularModule = angular.module;


angular.module = function() {
  var module = originalAngularModule.apply(this,arguments);
  if(module.requires.length) {
    storeDependencies(module);
  }
  if(getModule(module.name, true)) {
    if(!modData.createdMulti[module.name]) {
      modData.createdMulti[module.name] = [getModule(module.name,true)];
    }
    modData.createdMulti[module.name].push(module);
  }
  modData.createdModules[module.name] = module;
  return module;
};

window.name = 'NG_DEFER_BOOTSTRAP!';
angular.element(document).ready(function() {
  start();
});

},{"./lib/getModule":59,"./lib/moduleData":65,"./lib/start":69,"./lib/storeDependencies":70,"angular-hint-log":54}],56:[function(require,module,exports){
module.exports = function(s,t) {
  var strMap = {},
      similarities = 0,
      STRICTNESS = 0.66;
  if(Math.abs(s.length-t.length) > 3) {
    return false;
  }
  s.split('').forEach(function(x){strMap[x] = x;});
  for (var i = t.length - 1; i >= 0; i--) {
    similarities = strMap[t.charAt(i)] ? similarities + 1 : similarities;
  }
  return similarities >= t.length * STRICTNESS;
};

},{}],57:[function(require,module,exports){
var hintLog = require('angular-hint-log');

module.exports = function(unusedModules) {
  unusedModules.forEach(function(module){
    console.log(module.message)
    hintLog.logMessage(module.message);
  });
};

},{"angular-hint-log":54}],58:[function(require,module,exports){
var modData = require('./moduleData');

module.exports = function() {
  var multiLoaded = [];
  for(var modName in modData.createdMulti) {
    var message = 'Multiple modules with name "'+modName+'" are being created and they will overwrite each other.';
    var multi = modData.createdMulti[modName];
    var details = {
      exsistingModule: multi[multi.length - 1],
      overwrittenModules: multi.slice(0,multi.length-1)
    };
    multiLoaded.push({module:details, message:message});
  }
  return multiLoaded;
};

},{"./moduleData":65}],59:[function(require,module,exports){
var modData = require('./moduleData');

module.exports = function(moduleName, getCreated) {
    return (getCreated)? modData.createdModules[moduleName] : modData.loadedModules[moduleName];
};

},{"./moduleData":65}],60:[function(require,module,exports){
var levenshteinDistance = require('./levenshtein');
var areSimilarEnough = require('./areSimilarEnough');
var modData = require('./moduleData');

module.exports = function(module){
  var min_levDist = Infinity,
      closestMatch = '';
  for(var createdModule in modData.createdModules) {
    if(areSimilarEnough(createdModule, module)) {
      var currentlevDist = levenshteinDistance(module, createdModule);
      closestMatch = (currentlevDist < min_levDist)? createdModule : closestMatch;
      min_levDist = (currentlevDist < min_levDist)? currentlevDist : min_levDist;
    }
  }
  return closestMatch;
};

},{"./areSimilarEnough":56,"./levenshtein":64,"./moduleData":65}],61:[function(require,module,exports){
var getModule = require('./getModule');
var getSuggestion = require('./getSuggestion');
var modData = require('./moduleData');

module.exports = function() {
  var undeclaredModules = [];
  for( var module in modData.loadedModules) {
    var cModule = getModule(module, true);
    if(!cModule) {
      var match = getSuggestion(module);
      var suggestion = (match) ? '; Try: "'+match+'"' : '';
      var message = 'Module "'+module+'" was loaded but does not exsist'+suggestion+'.';
      undeclaredModules.push({module:null, message:message});
    }
  }
  return undeclaredModules;
};

},{"./getModule":59,"./getSuggestion":60,"./moduleData":65}],62:[function(require,module,exports){
var getModule = require('./getModule');
var modData = require('./moduleData');

module.exports = function() {
  var unusedModules = [];
  for(var module in modData.createdModules) {
    if(!getModule(module)) {
      var cModule = getModule(module, true);
      var message = 'Module "'+cModule.name+'" was created but never loaded.';
      unusedModules.push({module:cModule, message:message});
    }
  }
  return unusedModules;
};

},{"./getModule":59,"./moduleData":65}],63:[function(require,module,exports){
var normalizeAttribute = require('./normalizeAttribute');

module.exports = function(attrs) {
  for(var i = 0; i < attrs.length; i++) {
    if(normalizeAttribute(attrs[i].nodeName) === 'ng-view'
      || attrs[i].value.indexOf('ng-view') > -1) {
      return true;
    }
  }
};

},{"./normalizeAttribute":68}],64:[function(require,module,exports){
module.exports=require(52)
},{}],65:[function(require,module,exports){
module.exports = {
    createdModules: {},
    createdMulti: {},
    loadedModules: {}
  };

},{}],66:[function(require,module,exports){
var inAttrsOrClasses = require('./inAttrsOrClasses');

module.exports = function() {
  var doms = Array.prototype.slice.call(document.getElementsByTagName('*'));
  return doms.some(function(elem) {
    var isElemName = elem.nodeName.toLowerCase() === 'ng-view';
    var isInAttrsOrClasses = inAttrsOrClasses(elem.attributes);
    return isElemName || isInAttrsOrClasses;
  });
};

},{"./inAttrsOrClasses":63}],67:[function(require,module,exports){
var ngViewExsists = require('./ngViewExsists');
var getModule = require('./getModule');

module.exports = function() {
  if(ngViewExsists() && !getModule('ngRoute')) {
    return {message: 'Directive "ngView" was used in the application however "ngRoute" was not loaded into any module.'};
  }
};

},{"./getModule":59,"./ngViewExsists":66}],68:[function(require,module,exports){
module.exports = function(attribute) {
  return attribute.replace(/^(?:data|x)[-_:]/,'').replace(/[:_]/g,'-');
};

},{}],69:[function(require,module,exports){
var getUnusedModules = require('./getUnusedModules');
var getUndeclaredModules = require('./getUndeclaredModules');
var formatMultiLoaded = require('./formatMultiLoaded');
var ngViewNoNgRoute = require('./ngViewNoNgRoute');
var display = require('./display');

module.exports = function() {
  var unusedModules = getUnusedModules();
  var undeclaredModules = getUndeclaredModules();
  var multiLoaded = formatMultiLoaded();
  var noNgRoute = ngViewNoNgRoute();
  if(unusedModules.length || undeclaredModules.length || multiLoaded.length || noNgRoute) {
    var toSend = unusedModules.concat(undeclaredModules)
      .concat(multiLoaded);
    if(noNgRoute) {
      toSend = toSend.concat(noNgRoute);
    }
    display(toSend);
  }
};

},{"./display":57,"./formatMultiLoaded":58,"./getUndeclaredModules":61,"./getUnusedModules":62,"./ngViewNoNgRoute":67}],70:[function(require,module,exports){
var modData = require('./moduleData');

module.exports = function(module) {
  module.requires.forEach(function(dependency){
    modData.loadedModules[dependency] = dependency;
  });
  modData.loadedModules[module.name] = module.name;
};

},{"./moduleData":65}],71:[function(require,module,exports){
//Create pipe for all hint messages from different modules
angular.hint = require('angular-hint-log');

// Load angular hint modules
require('angular-hint-controllers');
require('angular-hint-directives');
require('angular-hint-dom');
require('angular-hint-events');

// List of all possible modules
// The default ng-hint behavior loads all modules
var allModules = ['ngHintControllers', 'ngHintDirectives', 'ngHintEvents', 'ngHintInterpolation']
// Determine whether this run is by protractor.
// If protractor is running, the bootstrap will already be deferred.
// In this case `resumeBootstrap` should be patched to load the hint modules.
if (window.name === 'NG_DEFER_BOOTSTRAP!') {
  var originalResumeBootstrap;
  Object.defineProperty(angular, 'resumeBootstrap', {
    get: function() {
      return function(modules) {
        return originalResumeBootstrap.call(angular, modules.concat(loadModules()));
      };
    },
    set: function(resumeBootstrap) {
      originalResumeBootstrap = resumeBootstrap;
    }
  });
}
//If this is not a test, defer bootstrapping
else {
  window.name = 'NG_DEFER_BOOTSTRAP!';

  // determine which modules to load and resume bootstrap
  document.addEventListener('DOMContentLoaded', maybeBootstrap);
}

function maybeBootstrap() {
  // we don't know if angular is loaded
  if (!angular.resumeBootstrap) {
    return setTimeout(maybeBootstrap, 1);
  }

  var modules = loadModules();
  angular.resumeBootstrap(modules);
}

function loadModules() {
  var modules = [], elt;

  if (elt = document.querySelector('[ng-hint-include]')) {
    modules = hintModulesFromElement(elt);
  } else if (elt = document.querySelector('[ng-hint-exclude]')) {
    modules = excludeModules(hintModulesFromElement(elt));
  } else if (document.querySelector('[ng-hint]')) {
    modules = allModules;
  } else {
    angular.hint.logMessage('Info: ngHint is included on the page, but is not active because there is no `ng-hint` attribute present');
  }
  return modules;
}

function excludeModules(modulesToExclude) {
  return allModules.filter(function(module) {
    return modulesToExclude.indexOf(module) == -1;
  });
}

function hintModulesFromElement (elt) {
  var selectedModules = (elt.attributes['ng-hint-include']
    || elt.attributes['ng-hint-exclude']).value.split(' ');

  return selectedModules.map(hintModuleName).filter(function (name) {
    return (allModules.indexOf(name) > -1) ||
      angular.hint.logMessage('Module ' + name + ' could not be found');
  });
}

function hintModuleName(name) {
  return 'ngHint' + title(name);
}

function title(str) {
  return str[0].toUpperCase() + str.substr(1);
}

},{"angular-hint-controllers":2,"angular-hint-directives":3,"angular-hint-dom":32,"angular-hint-events":34,"angular-hint-log":54}]},{},[1])