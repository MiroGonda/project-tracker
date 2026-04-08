# README #

Project HAILSTORM is the API of Raintool.

Please read below links to start your development:

1. Development Environment
https://3.basecamp.com/4193720/buckets/11409652/messages/2435886334

2. Code Linting
https://3.basecamp.com/4193720/buckets/11409652/messages/2436604439

3. Development Standards
https://3.basecamp.com/4193720/buckets/11409652/messages/2436607063

##==================================================================

# Lumen PHP Framework

How to setup Lumen PHP Framework:

1. Create .env file using .env.example file. Update configuration for your machine.
2. Run composer install in root directory to install dependencies

# API Guide

# Project

## Add Project
Add a new project

`project/add`

**Parameters**

   * `name`                      - Project name
   * `priotity`                  - Project Priority
   * `client`                    - Client ID
   * `dateStarted`               - Date on when project started
   * `status`                    - Status of project
   * `estimatedDateOfCompletion` - Estimated completion of project
   * `estimatedNoOfHours`        - Estimated hours to be completed


**Return**
```
{
    "projectId": 1
}
```

## Update Project
Update an existing project 

`project/update`

**Parameters**

   * `projectId`                 - Project ID
   * `name`                      - Project name
   * `priotity`                  - Project Priority
   * `client`                    - Client ID
   * `dateStarted`               - Date on when project started
   * `status`                    - Status of project
   * `estimatedDateOfCompletion` - Estimated completion of project
   * `estimatedNoOfHours`        - Estimated hours to be completed

**Return**
```
{
    "updated": true
}
```

## Delete Project
Delete an existing project

`project/delete`
     
   * `projectId`                 - Project ID

**Return**
```
{
    "deleted": true
}
```

## List Active Projects
List all active and running projects

`project/list-active-projects`

**Return**
```
{
    "projects": [
        {
            "ProjectID": 321,
            "name": "AIM: Maintenance - February 2019",
            "projectValue": "0.000000000",
            "priority": "1",
            "client": 72,
            "dateStarted": "2019-02-01",
            "serviceType": 22,
            "status": "development",
            "Type": null,
            "IsDeleted": 0,
            "DateDeleted": "2019-06-27 04:03:31",
            "DateCreated": "2019-02-01 19:03:16",
            "DateUpdated": "2020-02-04 04:30:50",
            "CreatedBy": "",
            "UpdatedBy": "",
            "dateEnded": "0000-00-00",
            "estimatedDateOfCompletion": "2019-02-28",
            "estimatedNoOfHours": "0.000000000"
        },
        ...
    ]
}
```

## List Completed Projects
List all completed projects

`project/list-completed-projects`

**Return**
```
{
    "projects": [
        {
            "ProjectID": 49,
            "name": "1150 Technologies Identity",
            "projectValue": "12500.000000000",
            "priority": "3",
            "client": 32,
            "dateStarted": "2010-03-08",
            "serviceType": 17,
            "status": "done",
            "Type": null,
            "IsDeleted": 0,
            "DateDeleted": "0000-00-00 00:00:00",
            "DateCreated": "2010-03-05 08:01:31",
            "DateUpdated": "2010-07-29 19:43:43",
            "CreatedBy": "",
            "UpdatedBy": "",
            "dateEnded": "2010-07-29",
            "estimatedDateOfCompletion": "2010-03-31",
            "estimatedNoOfHours": "25.000000000"
        },
        ...
    ]
}
```
---

## List Active Projects of User
Return the list of all the active projects the user belongs to

`project/list-active-projects-of-user`

**Parameters**

   * `bindname`                - Bindname (with @)

**Return**
```
{
    "projects": [
        {
            "ProjectID": 475,
            "name": "AIM: Website Maintenance (February 2020)"
        }
        ...
    ]
}
```

---
## Write Access
Users with write access control to a project are the one who can add, edit and delete tasks. Here are the list of control access API you can use:

## Has Write Access to Project
Check if the user has a write access to a project

`project/has-write-access`

**Parameters**

   * `bindname`                 - Bindname
   * `projectId`                - Project ID

**Return**
```
{
    "access": true
}
```

## Grant Write Accesss to Project
Grant write access to a project. The user adding a new user should have a write access to allow this operation to be successful.

`project/allow-write-access`

**Parameters**

   * `bindname`                 - Bindname
   * `currentUser`              - Current user (should have write access)
   * `projectId`                - Project ID

**Return**
```
{
    "granted": true
}
```

## Revoked Write Access to Project
Revoked write access to project. The user can't revoked his own access. The user revokeing a user's access should have a write access first for the operation to be successful.

`project/revoke-write-access`

**Parameters**

   * `bindname`                 - Bindname
   * `currentUser`              - Current user (should have write access)
   * `projectId`                - Project ID

**Return**
```
{
    "revoked": true
}
```

## List Users with Write Access
Return the list of users with write access to a project

`project/with-write-access`

**Parameters**

   * `projectId`                - Project ID


**Return**
```
{
    "writeAccess": [
        "@jpdguzman",
        "@kimtan"
    ]
}
```

---

## Reports

To access reports, you can use the following API end points:

```api/report/generate/{type}/{name}```

---
Here are the list of report types and names:

`task/task-by-project`

Return the list of tasks done on the project.

**Parameters**

* `dateFrom` – Start of date range. It uses the following format: Y-m-d
* `dateTo` - End of date range. It uses the following format: Y-m-d
* `projectId` - Project ID

**Return**

Results are ordered from latest to oldest

```
[
    {
        "date": "2020-01-31",
        "resource": "migobundoc",
        "taskId": 24269,
        "projectId": 318,
        "projectName": "Globe Broadband: Jaya Team",
        "activity": {
            "parsed": "Create weekly status report",
            "original": "Create weekly status report @migobundoc"
        },
        "timeSpent": {
            "hours": 0.5844444444444444,
            "seconds": "2104"
        }
    }
]
```

 `task/task-by-resource`

 Return the list of tasks done by the resource

 **Parameters**

* `dateFrom` – Start of date range. It uses the following format: Y-m-d
* `dateTo` - End of date range. It uses the following format: Y-m-d
* `bindname` - Resource bind name with – `@user`

**Return**

Results are ordered from latest to oldest

```
[
    {
        "date": "2020-01-31",
        "resource": "migobundoc",
        "taskId": 24269,
        "projectId": 318,
        "projectName": "Globe Broadband: Jaya Team",
        "activity": {
            "parsed": "Create weekly status report",
            "original": "Create weekly status report @migobundoc"
        },
        "timeSpent": {
            "hours": 0.5844444444444444,
            "seconds": "2104"
        }
    }
]
```

# User

## Add user account
Add a new user

`user/add`

**Parameters**
     * `firstName`              - First name
     * `lastName`               - Last Name
     * `bindname`               - Bindname
     * `email`                  - Email address
     * `position`               - Position

**Return**
```
[
  "userId": 319
]

```

## Update user account
Update an existing user

`user/update`

**Parameters**
     * `userId`                 - User ID
     * `firstName`              - First name
     * `lastName`               - Last Name
     * `bindname`               - Bindname
     * `email`                  - Email address
     * `position`               - Position

**Return**
```
[
  "updated": true
]

```

## Delete user
Delete an existing user

`user/delete`

**Parameters**
     * `projectId` - Project ID to be deleted

**Return**
```
[
  "deleted": true
]

```

## List active users
List all active users

`user/list-active-users`

**Return**
```
[
  "users": [
     {
      "userId": 47,
      "firstName": "Alexandria",
      "lastName": "Mesias",
      "bindname": "@alexandriamesias",
      "email": null,
      "position": "Content Writer"
    }
  ]
]

```

## List inactive users
List all inactive users

`user/list-inactive-users`

**Return**
```
[
  "users": [
    {
      "userId": 23,
      "firstName": "Angelica Riz",
      "lastName": "Ganhinhin",
      "bindname": "@aicaganhinhin",
      "email": null,
      "position": "Project Coordinator"
    }
  ]
]

```

## List all users
List all users (both inactive and active users)

`user/all`


**Return**
```
[
  "users": [
    {
      "userId": 23,
      "firstName": "Angelica Riz",
      "lastName": "Ganhinhin",
      "bindname": "@aicaganhinhin",
      "email": null,
      "position": "Project Coordinator"
    }
  ]
]

```

## Change user status
Change user status to active or inactive

`user/change-status`

**Parameters**
     * `userId`                  - User ID
     * `status`                  - 1 = activated; 0 = deactivated

**Return**
```
[
  "updated": true
]

```

# Task

## Add task
Add new task

`task/add`

**Parameters**
     * `task`                    - Task name
     * `projectId`               - Project ID
     * `estimates`               - Estimates (in Hours)
     * `deadline`                - Deadline of the task
     * `bindname`                - Current bindname

**Return**
```
[
  "taskId": 123
]

```

## Update task
Update an existing task

`task/update`

**Parameters**
     * `toDoId`                  - Task ID
     * `task`                    - Task name
     * `projectId`               - Project ID
     * `estimates`               - Estimates (in Hours)
     * `deadline`                - Deadline of the task
     * `bindname`                - Current bindname

**Return**
```
[
  "updated": true
]

```
 
## Delete task
Delete existing task

`task/delete`

**Parameters**
     * `toDoId`                  - Task ID

**Return**
```
[
  "delete": true
]

```

## Start task
Start a task

`task/start`

**Parameters**
     * `toDoId`                  - Task ID
     * `bindname`                - Current User

**Return**
```
[
  "started": true
]

```

## Stop task
Stop a running task

`task/stop`

**Parameters**
     * `toDoId`                  - Task ID
     * `bindname`                - Current User

**Return**
```
[
  "stopped": true
]

```

## System heartbeat
List users all with active tasks

`task/system-heartbeat`

**Parameters**
     * `bindname`                - Current User

**Return**
```
[
  "task": [
    "running" : false
    "usersWithActiveTasks": [
        "jpdguzman",
        "userA",
        "userB"
    ]
  ]
]


```

## Mark task as done
Mark an existing task as completed / done.

`task/is-done`

**Parameters**
     * `toDoId`                  - Task ID
     * `bindname`                - Current bindname

**Return**
```
[
  "isDone": true
]

```

## Currently Running Task
Get currently running task of user. It returns the
start time and elapse time.

`task/currently-running`

**Parameters**
     * `toDoId`                  - Task ID

**Return**
```
[
  "currentlyRunningTask": {
    "started": "2020-03-20 10:23:44"
    "started_ts": 1584699824
    "elapsed": 1
    "bindnames": "@test"
  }
]


```

## Bulk Upload Task
Upload a list of tasks

`task/bulk-upload`

**Parameters array values**
     * `task`         - name of task
     * `bindname`     - assigned resource
     * `estimates`    - estimated hours
     * `deadline`     - date until
     * `projectId`    - Project ID

**Return**
```
"createdIds": [
    26441,
    26442
  ]
```
