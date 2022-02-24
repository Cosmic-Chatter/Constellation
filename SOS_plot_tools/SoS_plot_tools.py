"""
Tools to assist in creating maps for display on Science on a Sphere.
"""

import time
import datetime
import subprocess

from dateutil import parser
import pandas as pd
import numpy as np
import matplotlib as mpl
from matplotlib import pyplot as plt
from matplotlib import cm
from matplotlib import patches
# import matplotlib.patches as patches
from matplotlib.collections import PatchCollection
from mpl_toolkits.basemap import Basemap
import shapefile
import netCDF4


def progress_bar(now, total, start_time=None):

    """Draw a progress bar.

    Now is the number of ticks we have completed, total is the maximum number of ticks
    """

    bar_str = "|"
    for i in range(25):
        if i/25 < now/total:
            bar_str += "="
        else:
            bar_str += ' '
    bar_str += "|"
    if start_time is not None and now > 0:
        time_per_tick = (time.time() - start_time)/now
        bar_str += " " + str(round(time_per_tick * (total - now))) + " sec remaining   "
    print(bar_str, end="\r")

def createContourMap(input,
    dataKey="",
    filename="",
    latKey="",
    levels=100,
    lonKey="",
    colormap="coolwarm",
    transparent=False):

    # Function to take a pandas DataFrame or a CSV file containing Lon/Lat values
    # and build a Science on a Sphere texture from it

    if isinstance(input, pd.DataFrame):
        df = input
    elif isinstance(input, str): # We probably got a CSV filename
        df = pd.read_csv(input)
    else:
        print("createContourMap: Error: You must pass either a CSV filename or a pandas DataFrame")
        return()

    # Identify the lat/lon columns, if not specified by user
    keys = df.keys().to_list()
    if latKey == "":
        possible_keys = ["latitude", 'Latitude', 'lat', 'Lat', 'LAT', "LATITUDE", 'reclat']
        for key in possible_keys:
            if key in keys:
                latKey = key
        if latKey == "": # If we haven't matched anything, user will need to supply latKey
            print("createContourMap: Error: latitude column not found. Specify with latkey=")
            return()
    if lonKey == "":
        possible_keys = ["longitude", 'Longitude', 'long', 'lon', 'Long', 'Lon',
                         'LON', 'LONG', "LONGITUDE", 'reclon', 'reclong']
        for key in possible_keys:
            if key in keys:
                lonKey = key
        if lonKey == "": # If we haven't matched anything, user will need to supply lonKey
            print("createContourMap: Error: longitude column not found. Specify with lonKey=")
            return()
    if dataKey == "":
        possible_keys = ["data", "DATA"]
        for key in possible_keys:
            if key in keys:
                dataKey = key
        if dataKey == "": # If we haven't matched anything, user will need to supply datakey
            print("createContourMap: Error: data column not found. Specify with datakey=")
            return()


    plt.rcParams["figure.figsize"] = (16,8)
    m = Basemap(projection='cyl',llcrnrlat=-90,urcrnrlat=90,\
                llcrnrlon=-180,urcrnrlon=180,resolution='l')

    if not transparent:
        m.drawcoastlines()
    plt.tricontourf(df[lonKey].astype(float).values,
                    df[latKey].astype(float).values,
                    df[dataKey].astype(float).values,
                    levels, cmap=colormap)

    plt.gcf().subplots_adjust(left=0, right=1, top=1, bottom=0)
    plt.gca().axis("off")

    if filename != "":
        plt.savefig(filename, dpi=256, transparent=transparent)

def movieFromFrames(frames, filename,
                    fps=5,
                    quality=1,
                    silent=True):

    """Wrapper for ffmpeg to turn a series of frames into a video formatted for Science on a Sphere.
    """

    if not "*" in frames:
        print(f"Error: filename must contain the wildcard character *. E.g., 'file_dir/*.jpg'")
        return

    try:
        process = subprocess.run(["ffmpeg", '-y', '-r', str(fps), '-pattern_type', 'glob',
                                    '-i', frames, '-c:v', 'mpeg4', '-q:v',
                                    str(quality), filename],
                                     capture_output=True, check=True)
        if not silent:
            print(f"File {filename} written")
    except subprocess.CalledProcessError as e:
        print(str(e.stderr, "UTF-8"))

def createContourMapFromNOAAPSL(input, index,
                                baseColor=None,
                                baseTexture=None,
                                colormap="coolwarm",
                                dataKey="",
                                debug=False,
                                filename="",
                                levels=100,
                                transparent=False):

    """Take a NetCDF file from the NOAA Physical Sciences Lab and turn it into a contour map.
    """

    if isinstance(input, netCDF4.Dataset):
        data = input
    elif isinstance(input, str): # We probably got a CSV filename
        data = netCDF4.Dataset(input)
    else:
        print("createContourMapFromNOAAPSL: Error: You must pass either a NetCDF filename or a netCDF4 Dataset instance")
        return()

    if dataKey == "":
        possible_keys = ["tmax", 'tmin', 'precip']

        for key in possible_keys:
            if key in data.variables:
                dataKey = key
                break
        if dataKey == "": # If we haven't matched anything, user will need to supply latKey
            print("createContourMapFromNOAAPSL: Error: data key not recognized. Specify with dataKey=")
            return()

    plt.rcParams["figure.figsize"] = (16,8)

    if baseTexture is not None:
        m = Basemap(projection='cyl',llcrnrlat=-90,urcrnrlat=90,\
                    llcrnrlon=0.25,urcrnrlon=359.75,resolution='l')
        m.warpimage(baseTexture)
    elif baseColor is not None:
        fig.patch.set_facecolor(baseColor)

    if not transparent:
        m.drawcoastlines()

    lat = data.variables['lat'][:]
    lon = data.variables['lon'][:]
    this_time = data.variables['time'][:]
    values = data.variables[dataKey][:]

    lons, lats = np.meshgrid(lon , lat)

    # Convert time from hours since epoch 1900-01-01
    epoch = datetime.datetime(1900, 1, 1, 0, 0)
    date = epoch + (datetime.timedelta(hours=1) * this_time)

    index_to_use = None
    if isinstance(index, (float, int)):
        index_to_use = round(index)
        if index_to_use >= len(date):
            print("createContourMapFromNOAAPSL: Error: index not present.")
            return()
    elif isinstance(index, str):
        try:
            index_to_use = np.where(date == parser.parse(index))[0][0]
        except IndexError:
            print("createContourMapFromNOAAPSL: Error: index not present.")
            return()
    else:
        print("createContourMapFromNOAAPSL: Error: index not recognized. Provide either a numeric index or a date")
        return()

    if debug:
        print("Dataset min value:", np.min(values[index_to_use, :, :]), "\nDataset max value:", np.max(values[index_to_use, :, :]))
    plt.contourf(lons, lats, values[index_to_use, :, :], levels, cmap=colormap)

    plt.gcf().subplots_adjust(left=0, right=1, top=1, bottom=0)
    plt.gca().axis("off")

    if filename != "":
        plt.savefig(filename, dpi=256, transparent=transparent)


def createScatterMap(input,
    add_to_map=None,
    filename="",
    latKey="",
    lonKey="",
    marker="o",
    marker_alpha=1,
    marker_color="#8c4d20",
    marker_color_key="",
    marker_size=5,
    marker_size_key="",
    return_map = True,
    transparent=False):

    """Function to take a pandas DataFrame or a CSV file containing Lon/Lat values and build a Science on a Sphere texture from it
    """

    if isinstance(input, pd.DataFrame):
        df = input
    elif isinstance(input, str): # We probably got a CSV filename
        df = pd.read_csv(input)
    else:
        print("createScatterMap: Error: You must pass either a CSV filename or a pandas DataFrame")
        return()

    # Identify the lat/lon columns, if not specified by user
    keys = df.keys().to_list()
    if latKey == "":
        possible_keys = ["latitude", 'Latitude', 'lat', 'Lat', 'LAT', "LATITUDE", 'reclat']
        for key in possible_keys:
            if key in keys:
                latKey = key
        if latKey == "": # If we haven't matched anything, user will need to supply latKey
            print("createScatterMap: Error: latitude column not found. Specify with latkey=")
            return()
    if lonKey == "":
        possible_keys = ["longitude", 'Longitude', 'long', 'lon', 'Long', 'Lon',
                         'LON', 'LONG', "LONGITUDE", 'reclon', 'reclong']
        for key in possible_keys:
            if key in keys:
                lonKey = key
        if lonKey == "": # If we haven't matched anything, user will need to supply latKey
            print("createScatterMap: Error: longitude column not found. Specify with lonKey=")
            return()

    if add_to_map is not None:
        m = add_to_map
    else:
        plt.rcParams["figure.figsize"] = (16,8)
        m = Basemap(projection='cyl',llcrnrlat=-90,urcrnrlat=90,\
                    llcrnrlon=-180,urcrnrlon=180,resolution='l')

    if not transparent:
        m.drawcoastlines()

    # If marker_size_key != "", interpret it as a DataFrame key and create
    # an array of sizes, with maximum size marker_size
    if marker_size_key != "":
        if marker_size_key not in df:
            print(f"createScatterMap: Warning: marker_size_key '{marker_size_key}' is not in the given table. Skipping...")
        else:
            marker_size = marker_size*df[marker_size_key].astype(float).values

    marker_color_list = [marker_color]
    if marker_color_key != "":
        if marker_color_key not in df:
            print(f"createScatterMap: Warning: marker_color_key '{marker_color_key}' is not in the given table. Skipping...")
        else:
            marker_color_list = df[marker_color_key]
            marker_color = None
    m.scatter(df[lonKey].astype(float), df[latKey].astype(float), marker_size, alpha=marker_alpha, c=marker_color_list, latlon=True, marker=marker)

    plt.gcf().subplots_adjust(left=0, right=1, top=1, bottom=0)
    plt.gca().axis("off")

    if filename != "":
        plt.savefig(filename, dpi=256, transparent=transparent)

    if return_map:
        return m

def createCountryMap(input,
    baseColor=None,
    baseTexture=None,
    colormap="Greens",
    countryKey="",
    dataKey="",
    filename="",
    isWorldBank=False,
    max_year=3000,
    min_year=0,
    printMissingCountries=False,
    range_min=None,
    range_max=None,
    transparent=False,
    yearKey=""):

    """Function to take a CSV file containing country-based data and build a Science on a Sphere texture from it.
    """
    if isinstance(input, pd.DataFrame):
        df = input
    elif isinstance(input, list):
        df = pd.DataFrame()
        df["Country"] = input
        df["Data"] = 1
    elif isinstance(input, str): # We probably got a CSV filename
        df = getOptimizedDataset(input,
                                 countryKey=countryKey,
                                 dataKey=dataKey,
                                 isWorldBank=isWorldBank,
                                 max_year=max_year,
                                 min_year=min_year,
                                 yearKey=yearKey)
    else:
        print("createCountryMap: Error: You must pass a CSV filename or a pandas DataFrame, or a list of countries")
        return


    # Matplotlib setup
    plt.rcParams["figure.figsize"] = (16,8)
    plt.clf()
    fig = plt.figure()
    ax = fig.add_subplot(111)

    if baseTexture is not None:
        m = Basemap(projection='cyl',llcrnrlat=-90,urcrnrlat=90,\
                    llcrnrlon=-180,urcrnrlon=180,resolution='l')
        m.warpimage(baseTexture)
    elif baseColor is not None:
        fig.patch.set_facecolor(baseColor)

    colormap = cm.get_cmap(colormap)
    if range_min is not None:
        vmin = range_min
    else:
        vmin = np.min(df["Data"])
    if range_max is not None:
        vmax = range_max
    else:
        vmax = np.max(df["Data"])
    norm = mpl.colors.Normalize(vmin=vmin, vmax=vmax)

    # Shapefile setup
    sf = shapefile.Reader("./world_shapefile/world.shp")
    records = sf.records()
    shapes = sf.shapes()
    num_shapes = len(shapes)

    country_names  = []
    for i in range(num_shapes):
        country_names.append(records[i][1])
    country_names = np.array(country_names)
    if isWorldBank:
        country_names = countryNameToWorldBank(country_names)
    else:
        country_names = countryNameNormalize(country_names)
        df["Country"] = countryNameNormalize(df["Country"].values)
    if printMissingCountries:
        print("Countries in input data that are not in the map data:")
        print((df[~df["Country"].isin(country_names)])["Country"].values)
        print("Countries in the map data that are not in the input data:")

    # Iterate the country shapes and color them based on the data
    for i in range(num_shapes):
        patches = []
        points = np.array(shapes[i].points)
        parts = shapes[i].parts
        par = list(parts) + [points.shape[0]]

        for j in range(len(parts)):
            patches.append(mpl.patches.Polygon(points[par[j]:par[j+1]]))

        country = country_names[i]

        try:
            val = float((df[df['Country'] == country])["Data"].values[0])
            base_color = colormap(norm(val))
            if baseTexture is not None:
                color = (base_color[0], base_color[1], base_color[2], 0.5) # Make patrially transparent
            else:
                color = base_color
            ax.add_collection(PatchCollection(patches,facecolor=color,edgecolor='k', linewidths=.1))
        except:
            if printMissingCountries:
                print(country)
            if baseTexture is None:
                color = "gray"
            else:
                color = (0,0,0,0.5)
            ax.add_collection(PatchCollection(patches,facecolor=color,edgecolor='k', linewidths=.1))


    fig.subplots_adjust(left=0, right=1, top=1, bottom=0)
    ax.axis("off")
    ax.set_xlim(-180,+180)
    ax.set_ylim(-90,90)

    if filename != "":
        plt.savefig(filename, dpi=256, facecolor=baseColor, transparent=transparent)

    #return(fig)

def createAnimatedCountryMap(df, min_year, max_year, filename,
                             isWorldBank=False,
                             createLabels=False,
                             **kwargs):

    """Takes a pandas DataFrane or CSV file and creates an output PNG for each year that can be used as an animation.
    """

    # Break the extension off the filename for later use
    filename_split = filename.split('.')
    filename_root = ".".join(filename_split[0:-1])
    filename_ext = "." + filename_split[-1]

    years = np.arange(min_year, max_year+1, 1)
    num_years = len(years)
    counter = 0
    start_time = time.time()
    labels = []
    for year in years:
        progress_bar(counter, num_years, start_time=start_time)
        counter += 1

        createCountryMap(df,
                         filename=filename_root+"_"+str(year)+filename_ext,
                         min_year=min_year,
                         max_year=year,
                         **kwargs)
        labels.append(str(year))

    if createLabels:
        # Create string from list
        label_str = ""
        for label in labels:
            label_str += label + "\n"
        with open("labels.txt", 'w', encoding="UTF-8") as f:
            f.write(label_str)

def countryNameNormalize(name, silent=True):

    """Function to correct names on the map to their correct generic name."""

    name_dict = {
        "Bahamas": "The Bahamas",
        "Bahamas, The": "The Bahamas",
        "Bolivia (Plurinational State of)": "Bolivia",
        "Burma": "Myanmar",
        "Byelarus": "Belarus",
        "Cape Verde": "Cabo Verde",
        "Czechia": "Czech Republic",
        "Democratic Republic of Congo": "Democratic Republic of the Congo",
        "Gambia": "The Gambia",
        "Gambia, The": "The Gambia",
        "Gaza Strip": "West Bank and Gaza",
        "Ivory Coast": "Cote d'Ivoire",
        "Kyrgyzstan": "Kyrgyz Republic",
        "Macedonia": "North Macedonia",
        "Man, Isle of": "Isle of Man",
        "Micronesia": "Federated States of Micronesia",
        "Myanmar (Burma)": "Myanmar",
        "Pacific Islands (Palau)": "Palau",
        "St. Kitts and Nevis": "Saint Kitts and Nevis",
        "St. Lucia": "Saint Lucia",
        "St. Vincent and the Grenadines": "Saint Vincent and the Grenadines",
        "Swaziland": "Eswatini",
        "Tanzania, United Republic of": "Tanzania",
        "Western Samoa": "Samoa",
        "Zaire": "Democratic Republic of the Congo",
    }

    if isinstance(name, str):
        if name in name_dict:
            return name_dict[name]
        if not silent:
            print(f"countryNameNormalize: name not found: {name}")
        return name
    elif isinstance(name, list):
        fixed_list = []
        for entry in name:
            if entry in name_dict:
                fixed_list.append(name_dict[entry])
            else:
                if not silent:
                    print(f"countryNameNormalize: name not found: {name}")
                fixed_list.append(entry)
        return fixed_list
    elif isinstance(name, np.ndarray):
        fixed_list = []
        for entry in name:
            if entry in name_dict:
                fixed_list.append(name_dict[entry])
            else:
                if not silent:
                    print(f"countryNameNormalize: name not found: {name}")
                fixed_list.append(entry)
        return(np.asarray(fixed_list))
    else:
        print("countryNameNormalize: Error: input format not recognized")
        return name

def countryNameToWorldBank(name, silent=True):

    """Take a country name and return it formatted for comparison to World Bank Databank data."""

    name_dict = {
        "Brunei": "Brunei Darussalam",
        "Burma": "Myanmar",
        "Byelarus": "Belarus",
        "Cape Verde": "Cabo Verde",
        "Congo": "Congo, Rep.",
        "Egypt": "Egypt, Arab Rep.",
        "Federated States of Micronesia": "Micronesia, Fed. Sts.",
        "Gaza Strip": "West Bank and Gaza",
        "Iran": "Iran, Islamic Rep.",
        "Ivory Coast": "Cote d'Ivoire",
        "Kyrgyzstan": "Kyrgyz Republic",
        "Laos": "Lao PDR",
        "Macau": "Macao SAR, China",
        "Macedonia": "North Macedonia",
        "Man, Isle of": "Isle of Man",
        "Myanmar (Burma)": "Myanmar",
        "North Korea": "Korea, Dem. People’s Rep.",
        "Pacific Islands (Palau)": "Palau",
        "Russia": "Russian Federation",
        "South Korea": "Korea, Rep.",
        "Swaziland": "Eswatini",
        "Syria": "Syrian Arab Republic",
        "Tanzania, United Republic of": "Tanzania",
        "Venezuela": "Venezuela, RB",
        "West Bank": "West Bank and Gaza",
        "Western Samoa": "Samoa",
        "Yemen": "Yemen, Rep.",
        "Zaire": "Congo, Dem. Rep.",
    }

    if isinstance(name, str):
        if name in name_dict:
            return name_dict[name]
        if not silent:
            print(f"countryNameToWorldBank: name not found: {name}")
        return name
    elif isinstance(name, list):
        fixed_list = []
        for entry in name:
            if entry in name_dict:
                fixed_list.append(name_dict[entry])
            else:
                if not silent:
                    print(f"countryNameToWorldBank: name not found: {name}")
                fixed_list.append(entry)
        return fixed_list
    elif isinstance(name, np.ndarray):
        fixed_list = []
        for entry in name:
            if entry in name_dict:
                fixed_list.append(name_dict[entry])
            else:
                if not silent:
                    print(f"countryNameToWorldBank: name not found: {name}")
                fixed_list.append(entry)
        return(np.asarray(fixed_list))
    else:
        print("countryNameNormalize: Error: input format not recognized")
        return name

def getOptimizedDataset(input,
                        countryKey="",
                        dataKey="",
                        isWorldBank=False,
                        max_year=3000,
                        min_year=0,
                        yearKey=""):

    """Take a csv file, read it, and build a new DataFrame that
    matches each country with the latest available year of data
    for that country.

    Years before min_year and after max_year are ignored.
    """

    if isWorldBank:
        getOptimizedDatasetWorldBank(input, max_year=max_year, min_year=min_year)
    else:

        if isinstance(input, pd.DataFrame):
            df = input
        elif isinstance(input, str): # We probably got a CSV filename
            df = pd.read_csv(input)
        else:
            print("getOptimizedDataset: Error: You must pass either a CSV filename or a pandas DataFrame")
            return

        # Make sure we have a valid key for everything we need
        keys = df.keys().to_list()

        if yearKey == "":
            possible_keys = ["year", 'Year', "YEAR", 'yr', 'Yr', 'YR']
            for key in possible_keys:
                if key in keys:
                    yearKey = key
            if yearKey == "": # If we haven't matched anything, user will need to supply latKey
                print("getOptimizedDataset: Error: year column not found. Specify with yearKey=")
                return

        if countryKey == "":
            possible_keys = ["country", "Country", "COUNTRY", "Nation", "State", "STATE", "state"]
            for key in possible_keys:
                if key in keys:
                    countryKey = key
            if countryKey == "": # If we haven't matched anything, user will need to supply latKey
                print("getOptimizedDataset: Error: country column not found. Specify with country=")
                return

        if dataKey == "":
            possible_keys = ["data", "DATA"]
            for key in possible_keys:
                if key in keys:
                    dataKey = key
            if dataKey == "": # If we haven't matched anything, user will need to supply datakey
                print("getOptimizedDataset: Error: data column not found. Specify with datakey=")
                return

        df[yearKey] = df[yearKey].astype(float)

        # Trim by the min_year and max_year
        df = df[df[yearKey] >= min_year]
        df = df[df[yearKey] <= max_year]

        # Now iterate through the DataFrame and get the latest year of data for each
        # country
        country_list = []
        data_list = []
        year_of_data = [] # Holds the year that data in data_list comes from

        countries_to_match = df[countryKey].unique()
        for country in countries_to_match:
            temp = df[df[countryKey] == country]
            row_to_use = temp[temp[yearKey] == temp[yearKey].max()]
            country_list.append(row_to_use[countryKey].values[0])
            year_of_data.append(row_to_use[yearKey].values[0])
            data_list.append(row_to_use[dataKey].values[0])

        output = pd.DataFrame()
        output["Country"] = country_list
        output["Data"] = data_list
        output["Data year"] = year_of_data

        return output


def getOptimizedDatasetWorldBank(csv, max_year=3000, min_year=0):

    """Take a csv file, read it, and build a new DataFrame that
    matches each country with the latest available year of data
    for that country.

    Years before min_year and after max_year are ignored.
    """

    data = pd.read_csv(csv, na_values="..")

    # Rename the year columns to be just years
    keys = data.keys().to_list()
    years_list = [] # The years we will be searching through min_year <= year_list <= max_year
    rename_dict = {}
    for key in keys:
        try:
            year = int(key[0:4])
            rename_dict[key] = str(year)
            if (year >= min_year) and (year <= max_year):
                years_list.append(year)
        except ValueError:
            rename_dict[key] = key
    data.rename(mapper=rename_dict, axis=1, inplace=True)
    years_list.sort(reverse=True) # Newest first

    # Now iterate through the DataFrame and get the latest year of data for each
    # country
    country_list = []
    data_list = []
    year_of_data = [] # Holds the year that data in data_list comes from

    for i in range(len(data)):
        row = data.iloc[i].dropna()
        for year in years_list:
            key = str(year)
            if key in row:
                country_list.append(row["Country Name"])
                data_list.append(row[key])
                year_of_data.append(year)
                break

    output = pd.DataFrame()
    output["Country"] = country_list
    output["Data"] = data_list
    output["Data year"] = year_of_data

    return output
