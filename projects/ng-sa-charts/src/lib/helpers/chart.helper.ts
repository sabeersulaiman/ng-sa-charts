import { SaChartDimensions, SaChartData } from '../models/chart-data.model';
import { ChartMetrics } from '../models/common.model';
import {
    ascending,
    sum,
    timeHour,
    timeDay,
    timeYear,
    timeMonth,
    timeFormat,
    timeMinute,
    timeWeek
} from 'd3';

function fixDemensions(node: HTMLElement, dems: SaChartDimensions) {
    const possibleWidth = node ? node.getBoundingClientRect().width : 300;
    const defaultDems: SaChartDimensions = {
        width: possibleWidth,
        height: possibleWidth * 0.4,
        margins: {
            top: 50,
            left: 50,
            bottom: 50,
            right: 50
        }
    };

    if (dems) {
        if (!dems.width) {
            dems.width = defaultDems.width;
        }

        if (!dems.height) {
            dems.height = dems.width * 0.4;
        }

        if (!dems.margins) {
            dems.margins = defaultDems.margins;
        }

        if (dems.margins.top === undefined) {
            dems.margins.top = defaultDems.margins.top;
        }

        if (dems.margins.right === undefined) {
            dems.margins.right = defaultDems.margins.right;
        }

        if (dems.margins.bottom === undefined) {
            dems.margins.bottom = defaultDems.margins.bottom;
        }

        if (dems.margins.left === undefined) {
            dems.margins.left = defaultDems.margins.left;
        }
    } else {
        // set the default dems
        dems = defaultDems;
    }

    return dems;
}

export function computeChartMetrics(
    node: HTMLElement,
    dems: SaChartDimensions,
    data: SaChartData
): ChartMetrics {
    const metrics: ChartMetrics = {};
    const xAxisHeight = 50;

    dems = fixDemensions(node, dems);

    // calculate the svg width & height
    metrics.svgWidth = dems.width;
    metrics.svgHeight = dems.height;

    // chart height & width - take axes into account
    metrics.chartHeight =
        metrics.svgHeight - dems.margins.top - dems.margins.bottom;
    if (!data.xAxis.disabled) {
        metrics.chartHeight -= xAxisHeight;
        metrics.xAxisLabelStart =
            metrics.chartHeight + dems.margins.top + (xAxisHeight - 16);
    }

    metrics.chartWidth =
        metrics.svgWidth - dems.margins.left - dems.margins.right;

    metrics.yDataMax = NaN;
    metrics.yDataMin = NaN;

    metrics.xDataMax = NaN;
    metrics.xDataMin = NaN;

    for (const d of data.series) {
        // first value in data is x-axis value if data is time series
        if (d.data && d.data.length > 0 && Array.isArray(d.data[0])) {
            d.data.sort((a, b) => ascending(a[0] as number, b[0] as number));
            if (!(metrics.xDataMax > d.data[d.data.length - 1][0])) {
                metrics.xDataMax = d.data[d.data.length - 1][0] as number;
            }

            if (!(metrics.xDataMin < d.data[0][0])) {
                metrics.xDataMin = d.data[0][0] as number;
            }
        }

        for (const dataPoint of d.data) {
            if (Array.isArray(dataPoint)) {
                const arr = dataPoint as (number | number[])[];

                let pointYSum: number;
                if (Array.isArray(arr[1])) {
                    // we have multiple blocks of data
                    pointYSum = sum(arr[1]);
                } else {
                    pointYSum = arr[1];
                }

                if (!(metrics.yDataMin < pointYSum)) {
                    metrics.yDataMin = pointYSum;
                }

                if (!(metrics.yDataMax > pointYSum)) {
                    metrics.yDataMax = pointYSum;
                }
            }
        }
    }

    metrics.yDataMax += metrics.yDataMax * 0.2;

    if (metrics.yDataMin < 0) {
        metrics.yDataMin -= metrics.yDataMin * 0.2;
    } else {
        metrics.yDataMin = 0;
    }

    // domain and range
    metrics.xDomain = [metrics.xDataMin, metrics.xDataMax];
    metrics.xRange = [
        dems.margins.left,
        metrics.chartWidth + dems.margins.left
    ];

    metrics.yDomain = [metrics.yDataMin, metrics.yDataMax];
    metrics.yRange = [metrics.chartHeight + dems.margins.top, dems.margins.top];

    // generate the axes
    if (!data.xAxis.disabled && data.xAxis.timeData) {
        if (data.xAxis.extendAreaToAxis) {
            metrics.xAxisInclusiveArea = metrics.yRange[0] + xAxisHeight;
        }
        generateAxes(metrics);

        if (!dems.margins.left) {
            metrics.xAxisPoints = metrics.xAxisPoints.filter(
                (_x, i) => i !== 0
            );
        }

        if (!dems.margins.right) {
            metrics.xAxisPoints = metrics.xAxisPoints.filter(
                (_x, i) => i !== metrics.xAxisPoints.length - 1
            );
        }
    }

    return metrics;
}

function generateAxes(metrics: ChartMetrics) {
    // find the difference in time
    const timeDiff = metrics.xDataMax - metrics.xDataMin;

    // range info
    let range: Date[] = [];
    const start = new Date(metrics.xDataMin);
    const end = new Date(metrics.xDataMax);
    const labelSize = 62.5;

    // find the format based on period
    let format: (d: Date) => string;
    const periodInDays = timeDiff / 8.64e7;
    if (periodInDays < 2) {
        // format 09:00 AM {size: 55 x 16}
        format = timeFormat('%I:%M %p');
        if (start.getMinutes() !== 0) {
            range.push(start);
        }
        range.push(...timeHour.range(start, end, 1));
        range.push(end);
    } else if (periodInDays < 65) {
        // format Jan 21 { size: 35 x 16 }
        format = timeFormat('%b %d');
        if (start.getHours() !== 0) {
            range.push(start);
        }
        range = timeDay.range(start, end, 7);
        range.push(end);
    } else {
        // format Jan 2017 { size: 50 x 16 }
        format = timeFormat('%b %Y');
        if (start.getDate() !== 1) {
            range.push(start);
        }
        range = timeMonth.range(start, end, 1);
        range.push(end);
    }

    const possibleLabels = Math.floor(
        (metrics.chartWidth - labelSize) / labelSize
    );
    const skipCount = Math.floor(range.length / possibleLabels);

    range = range.filter((_x, i) => {
        if (i === 0 || i === range.length - 1 || i % skipCount === 0) {
            return true;
        }
    });

    metrics.xAxisPoints = [];
    for (const date of range) {
        metrics.xAxisPoints.push({
            text: format(date),
            x: date.getTime()
        });
    }
}