= oneYUI - yui3 performance measuring and improving tool =
== Background ==
YUI 3 supports sandbox, which can make different module codes runs in different space safely. In most case, a page assembled by many modules, which means lots of YUI sandboxes will be created. The good points of YUI 3 sandbox are:
* Allowing you to create an instance of YUI in your own namespace and only load the modules that you need. It makes it easier for multiple developers to work on different parts of the page with different modules with less worry of them stepping on each other's toes.
* If another version of YUI is loaded on the page, it will not change objects used in existing YUI instances. Both versions of YUI will operate with the corresponding versions of the reqested YUI modules without impacting each other.
But, it also makes some problems:
* Every sandbox (M) comsumes more memory if we load more yui modules (N). (Total M * N)
* When we created a lot of YUI instances in a page, IE6 will take obviously longer time to create sandbox, and stops to response for a while.
Here is a table of comparson:
{|
! Browser \ Test case !! use('node') (20 modules) !! use('widget') (30 modules)
|-
| IE6 || 260 || 428
|-
| IE7 || 65 || 90
|-
| FF7 || 6 || 11
|-
| chrome || 5 || 8
|} (yui3 instance creation time in millisecond)

If we only create one yui3 instance, then yui3 modules will only do initialization tasks once. The cost of use() function will be very low: 

{|
! Browser \ Test case !! use('node', 'event') !! use('widget')
|-
| IE6 || 11.56 || 21.6
|-
| IE7 || 6 || 12.28 
|-
| FF7 || 0.66 || 1.21
|-
| chrome || 0.38 || 0.65
|} (yui3 instance creation time in millisecond)

== What we do ==
The oneYUI performance tool can help yui3 developers to measure yui3 add/use time. When a page include one_yui3.js without any config, this tool will mimic 'only create one Y instance for this page' behavior in IE6/7 to reduce performance impact. With configuration, this tool can generate detail report about page loading and yui execution time.

'''oneYUI feature list:'''
* No need to modify any other javascript code exists on the page
* Detect browser and apply 'one instance' logic automatically
* Measuring page loading time
* Measuring yui 3 add() , use() time
* Collecting yui 3 combo js/css usages
* Wrap yui 3 use() to create only one instance
* Generate reports
* Configurable
* skip YUI.add or YUI().use() to measure basic page download time
* Test automation
