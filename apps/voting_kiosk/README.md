# Voting Kiosk
Voting Kiosk provides a touchscreen interface for collection single-question survey data and storing it on Control Server.

## Configuration

### Choosing hardware
Voting Kiosk can operate from either a local machine (i.e., a Windows or Linux PC with a touchscreen display) or a remote client (such as an iPad). If using a remote client, it is still required to install Constellation Apps on a PC.

### Layout
Voting Kiosk will create a sensible layout for your question's options. With six or fewer options, they will be arranged in one row (landscape orientation) or one column (portrait). With more than six options, they will be arranged with four on each row (landscape) or two on each row (portrait).

## Retrieving the data

![A screenshot of the data download interface.](download_data.jpg)

Collected data is stored on Control Server in `JSON` format, and then converted to `CSV` for downloading. To download data for a given survey question, open the Control Server web console and navigate to _Settings_ > _Data_. Click the _Refresh_ button, and then select your data file from the dropdown list. The file will have the same name as your `defintion`. Click _Download_ to download the data as a `CSV` file that can be opened in any spreadsheet software.

