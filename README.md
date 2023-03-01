# Welcome to OCR-UTILITY!
This program is intended to extract information from the invoice and correlate the given information with the extracted information.
# Installation
     apt-get install build-essential
     apt-get install graphicsmagick
     apt-get install poppler-utils
     apt-get install imagemagick
     git clone https://github.com/azharsys/extraction.git as ocr-utility
     cd ocr-utility
     npm install

# Running the application
There are 2 ways this application can be run
 1. As standalone utility
 2. As a web service

You can also run this in docker by executing following command

    docker-compose up -d --build
## 1. Standalone Utility

    Usage: index.js <command> [options]

	Commands:
	  index.js run  starts executing the process

	Options:
	  --version     Show version number                                    [boolean]
	  -f, --file    Load a file                                           [required]
	  -o, --output  output folder                                         [required]
	  -h, --help    Show help                                              [boolean]

	Example:
	  node ./index.js run -f foo.csv -o output

Input file is a csv with following fields.

|File Path|Template | isOCR|requiredField1|requiredField2|requiredFieldN|
|--|--|--|--|--|--|
|  |  |  |  |  |  |


## 2. Web service

    node server.js

By default this will start a web server on port 3000
It sets up a POST call http://localhost:3000/
Post Body should be of content-type **form-data**

    {
	    "file": "file_to_upload",
	    "isOCR": BOOLEAN
	    "docType": "BILL_OF_LADING"
	    "requiredFields": [{
		    "fieldName": "billOfLadingNo"
	    }]
    }


# Template File (YML)
Patterns in template file are defined via Grok/Oniguruma
Template file have following fields
```yml
issuer: "string"
extractor:
  pdf: "pdfjs|xpdf"
  google_vision: BOOLEAN
patterns:
  - "string|regex"
  - "string|regex"
aggregate:
  sum:
    - FILED_NAME_1
    - FILED_NAME_2
sections:
  - section:
      patterns:
        - "grok|oniguruma"
      start:
        pattern: "string|regex"
        from_end_index: INTEGER
        skip_lines: INTEGER
        inclusive: true
      end:
        pattern: "string|regex"
        from_start_index: INTEGER
        skip_lines: INTEGER
        inclusive: true
      encapsulate_key: "key"
      lines:
        merge:
          condition:
            patterns:
             - "regex"
             from_line: INTEGER
          string: "string"
        start:
          pattern: "string|regex"
          last_index: BOOLEAN
          index: INTEGER
        end:
          pattern: "string|regex"
          last_index: BOOLEAN
          index: INTEGER
      clean_fields:
        FIELD_NAME:
          remove:
            - \t
            - ●
          replace:
            this: "string|pattern"
            with: "string"
```
## Explanation
Template can broken down into following
```YML
extractor:
  pdf: "pdfjs|xpdf"
  google_vision: BOOLEAN
```
This section tells for the given pdf file which pdf text extractor should be used. google_vision if sets to true will first convert pdf to image and than google vision will process on it giving the output which is than translated to pdf by ocr-utility and than pdf extractor is used to extract text.
```yml
patterns:
  - "%{NUMBER:lineNumber}(?:\t)%{NUMBER:materialCode}(?:\t)%{DATA:material}(?:\t)%{SPACE}%{NUMBER:quantity}%{GREEDYDATA}"
  - "Total(?:\t)%{NUMBER:qty}%{SPACE}%{WORD}(?:\t)%{SPACE}(?<netWeight>(\\d+\\,)*\\d*(\\.\\d+)*)%{SPACE}(?<grossWeight>(\\d+\\,)*\\d*(\\.\\d+)*)%{SPACE}(?<volume>(\\d+\\,)*\\d*(\\.\\d+)*)"
```
This section defines the patterns which will be exec on each line in the given document to extract text.

    Example:
    consider following line
    1	X33200Y	@Amazing spiderman● database!%	10	DVD	Blue-Ray	10$
	%{NUMBER:lineNumber}(?:\t)%{NUMBER:materialCode}(?:\t)%{DATA:material}(?:\t)%{SPACE}%{NUMBER:quantity}%{GREEDYDATA}
    when this pattern will run against the line it will extract following information.
    {
	    "lineNumber": 1,
	    "materialCode": "X33200Y",
	    "material": "Amazing spiderman database",
	    "qty": "10"
    }
```yml
aggregate:
  sum:
    - qty
```
This section defines if we need to aggregate values, currently only sum is implemented.
Consider the above example, in which we extracts qty. When we want to aggregate all the qty into a single qty we use this option in yml.
```yml
clean_fields:
  material:
    remove:
      - \t
      - ●
    replace:
      this: "database"
      with: "movie"
```
Consider the above example
This section will search for the field material. If there is field material it will execute these options i.e. remove and replace
It will remove \t and ● from the string if any.
The replace section will find database and replace it with movie
The final output for material would me "Amazing spiderman movie"

We can define multiple sections as well each section can have following keys
```yml
patterns:
  - "grok|oniguruma"
start:
  pattern: "string|regex" # start line of the section
  from_end_index: INTEGER # start line of the section in reference to end line of section
  skip_lines: INTEGER # if we want to skip some lines from section start
  inclusive: true # if we want to include start line of the section in extraction
end:
  pattern: "string|regex" # end line of the section
  from_start_index: INTEGER # end line of the section in reference to start line of section
  skip_lines: INTEGER # if we want to skip some lines from section end
  inclusive: true # if we want to include end line of the section in extraction
encapsulate_key: "key" # wraps the extracted result in this section in the defined key
lines: # rules to apply on each line under this section
  merge: # lines to merge
    condition: # if we want to apply some condition
      patterns:
        - "regex"
      from_line: INTEGER|REGEX # from which line do we want to apply pattern
    string: "string"
  disable: # lines to disable any rule validation
    condition: # if we want to apply some condition
      patterns:
        - "regex"
      from_line: INTEGER|REGEX # from which line do we want to apply pattern
      to_line: INTEGER|REGEX # to which line do we want to apply pattern
      extract_patterns:
        - "regex"
  start: # rules to apply i.e. line starts from this position
    pattern: "string|regex"
    last_index: BOOLEAN
    index: INTEGER
  end: # rules to apply i.e. line ends at this position
    pattern: "string|regex"
    last_index: BOOLEAN
    index: INTEGER
clean_fields: # please see above for the description of this field
```
Let's consider an example
```javascript
const text = `
Some text that is extracted is above this line
Consignee
Some dynamic strings
1	MASCOT INTERNATIONAL PVT. LTD.	Corporation
		MANIK VILLA (FORMERLY JAGDISHKUNJ),		Weight=34KG
		11,R.A.KIDWAI ROAD,WADALA,	Volume=10CMU
		MUMBAI  400031
		India
2	Primary		Shipment	Ocean
3	Secondary	Ocean	Volume
Some text that is extracted is below this line
`
```
```yml
section:
  patterns:
    - %{GREEDYDATA:consignee}
  start:
    pattern: "^Consignee"
    skip_lines: 1
  end:
    from_start_index: 6
    inclusive: true
  lines:
    merge:
      string: \n
    start:
      pattern: \t
    end:
      pattern: \t
```
The system identify this section by first searching the start pattern and end pattern (if any)
System will search string starting from Consignee and than create a block of Start and End.
The following text will be selected. Note: 'Some dynamic strings' is not in the result, this is due to skip_lines

    1	MASCOT INTERNATIONAL PVT. LTD.	Corporation
    		MANIK VILLA (FORMERLY JAGDISHKUNJ),		Weight=34KG
    		11,R.A.KIDWAI ROAD,WADALA,	Volume=10CMU
    		MUMBAI  400031
    		India

System will parse each line and picks a substring that will depend on the line's start pattern and line's end pattern
We have defined in template line starts from tab and ends at tab we will get following after this

    MASCOT INTERNATIONAL PVT. LTD.
	MANIK VILLA (FORMERLY JAGDISHKUNJ),
	11,R.A.KIDWAI ROAD,WADALA,
	MUMBAI  400031
	India
System will see if we want this section lines to merge. If yes than we need to give line's merge_string  which in this case is \n (new-line)
After the system merges these lines it will run grok pattern on it to extract the information.

# Building Images and Deploying to Stage

There are a collection of npm scripts in package.json to ease building, tagging, and deploying docker images to staging. This is the typical workflow.

Note: there is no docker image versioning on stage. All images are tagged `latest` and are meant to replace existing versions. Production versions will be tagged, however.

## tl;dr

1. `npm run docker:build:base` builds the base OS image.
1. `npm run docker:build` builds the app image.
1. `npm run deploy` deploys the app image and restarts the service to use the new image.

## Details

1. Builds the base OS image. This builds the `ocr-utility-api-base:latest` base image that has all `apt-get` dependencies installed. This only needs to be done if these OS dependencies change.
1. Build the application image `ocr-utility-api:latest` (just copies new code and runs `npm install`). This builds the image that will be pushed to AWS ECR and run on ECS Fargate.
1. Deploy the image to staging. This is a 4-part command that will login to ECR, tag the current latest build with the remote repo, push the image to ECR, then restart the app once the image is pushed.
