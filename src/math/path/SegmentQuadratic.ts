/**
 * License: see license.txt file.
 */

/// <reference path="../Point.ts"/>
/// <reference path="./Segment.ts"/>
/// <reference path="./ContainerSegment.ts"/>
/// <reference path="./BezierTracer.ts"/>
/// <reference path="../Path.ts"/>
/// <reference path="../../render/RenderingContext.ts"/>

module cc.math.path {

    import Vector= cc.math.Vector;
    import Point= cc.math.Point;
    import Segment = cc.math.path.Segment;
    import ContainerSegment = cc.math.path.ContainerSegment;
    import Path = cc.math.Path;

    var __v0 : Vector = new Vector();

    /**
     * @class cc.math.path.SegmentQuadraticInitializer
     * @interface
     * @classdesc
     *
     * A quadratic curve is composed of 2 points (initial=p0 and end point=p2) and a tension control point=p1.
     *
     */
    export interface SegmentQuadraticInitializer {

        /**
         * First curve point.
         * @member cc.math.path.SegmentQuadraticInitializer#p0
         * @type {cc.math.Point}
         */
        p0 : Point;

        /**
         * Curve control point.
         * @member cc.math.path.SegmentQuadraticInitializer#p1
         * @type {cc.math.Point}
         */
        p1 : Point;

        /**
         * last curve point.
         * @member cc.math.path.SegmentQuadraticInitializer#p2
         * @type {cc.math.Point}
         */
        p2 : Point;
    }

    /**
     * @class cc.math.path.SegmentQuadratic
     * @implements cc.math.path.Segment
     * @classdesc
     *
     * This Object is a Quadratic Bezier Segment.
     * <p>
     *     It is composed of two points and a tension control point. Internally, the Segment can cache its contour.
     * <p>
     *     The contour can be of two different types:
     *     + directly traced over the curve. Leaves points at different distances on the curve.
     *     + equi-distant on the curve. Internally traces the points as in the other type, but then creates a polyline
     *       path with the points, and samples the resulting path at regular intervals. This transforms the curve into
     *       a polyline, which is faster for most calculations, but could not be as smooth as the other type.
     * <p>
     * By default, the curve is calculated with the first type, directly tracing on the curve
     *
     */
    export class SegmentQuadratic implements Segment {

        /**
         * Start quadratic curve point.
         * @member cc.math.path.SegmentQuadratic#_p0
         * @type {cc.math.Vector}
         * @private
         */
        _p0 : Vector = null;

        /**
         * Quadratic curve control point.
         * @member cc.math.path.SegmentQuadratic#_cp0
         * @type {cc.math.Vector}
         * @private
         */
        _cp0: Vector = null;

        /**
         * End quadratic curve point.
         * @member cc.math.path.SegmentQuadratic#_p1
         * @type {cc.math.Vector}
         * @private
         */
        _p1 : Vector = null;

        /**
         * Internal flag for cache validity.
         * @member cc.math.path.SegmentQuadratic#_dirty
         * @type {boolean}
         * @private
         */
        _dirty : boolean = true;

        /**
         * Parent segment.
         * @member cc.math.path.SegmentQuadratic#_parent
         * @type {cc.math.path.Segment}
         * @private
         */
        _parent : ContainerSegment = null;

        /**
         * Segment length. It is approximately calculated by subdividing the curve.
         * @member cc.math.path.SegmentQuadratic#_length
         * @type {number}
         * @private
         */
        _length : number = 0;

        /**
         * Whether the Quadratic is internally treated as a polyline.
         * @member cc.math.path.SegmentQuadratic#_flattened
         * @type {boolean}
         * @private
         */
        _flattened : boolean = false;

        /**
         * A cache of points on the curve. This is approximation with which the length is calculated.
         * @member cc.math.path.SegmentQuadratic#_cachedContourPoints
         * @type {Array<cc.math.Vector>}
         * @private
         */
        _cachedContourPoints : Vector[] = null;

        /**
         * Create a new Quadratic Segment instance.
         * @param data {cc.math.path.SegmentQuadraticInitializer=}
         */
        constructor( data? : SegmentQuadraticInitializer ) {
            if ( data ) {
                this.initialize( data.p0, data.p1, data.p2 );
            }
        }

        /**
         * Initialize the Segment with the supplied points.
         * @param p0 {cc.math.Point} start curve point.
         * @param p1 {cc.math.Point} curve control point.
         * @param p2 {cc.math.Point} end curve point}
         */
        initialize( p0:Point, p1:Point, p2:Point ) : void {

            this._p0= new Vector( p0.x, p0.y );
            this._cp0= new Vector( p1.x, p1.y );
            this._p1= new Vector( p2.x, p2.y );

            this.__update();
            this._dirty= false;
        }

        /**
         * Flatten this Segment and consider it a polyline with equidistant points.
         * @param numPoints {number=} Number of points (meaning numPoints-1 line segments). If not set, the number of
         *        points will be exactly the same resulting from tracing the Quadratic segment. (you are good by not
         *        supplying a value).
         * @returns {cc.math.path.SegmentQuadratic}
         */
        flatten( numPoints? : number ) : SegmentQuadratic {

            // already flattened and with the same amount of points ? do nothing dude.
            if ( !this._dirty && this._flattened && numPoints===this._cachedContourPoints.length ) {
                return;
            }

            // trace this quadratic segment
            var points : Vector[] = cc.math.path.traceQuadratic( this._p0, this._cp0, this._p1 );

            // build a polyline of the specified number of points, or as much as twice the traced contour.
            // twice, since after all, we are approximating a curve to lines. and this is just preprocess, won't hurt
            // the long term.
            numPoints = numPoints || points.length * 2;

            // now path is a polyline which is not proportionally sampled.
            var path : Path = cc.math.Path.createFromPoints( points );

            // sample the path and get another polyline with each point at a regular distance.
            points= [];
            path.trace( numPoints, points );

            // signal flattened data
            this._flattened= true;

            // save data for later usage
            this._cachedContourPoints= points;

            // update segment length
            this.__calculateLength();

            // not dirty, caches and length are freshly calculated
            this._dirty= false;

            return this;
        }

        /**
         * Update the Quadratic Segment info.
         * @param numPoints {number=}
         * @private
         */
        __update(numPoints? : number) : void {

            this._dirty = false;

            numPoints = numPoints || (this._cachedContourPoints && this._cachedContourPoints.length) || cc.math.path.DEFAULT_TRACE_LENGTH;

            // and was flattened
            if (this._flattened) {
                // recalculate polyline of equally distributed points
                this.flatten();
            } else {
                // was not flattened
                this._cachedContourPoints = [];
                for (var i = 0; i <= numPoints; i++) {
                    this._cachedContourPoints.push(this.getValueAt(i / numPoints, new Vector()));
                }
            }


            this.__calculateLength();
        }

        __calculateLength() : void {
            var points = this._cachedContourPoints;
            // calculate distance
            this._length=0;
            for( var i=0; i<points.length-1; i++ ) {
                this._length+= points[i].distance( points[i+1] );
            }

        }

        /**
         * Get the Segment's parent Segment.
         * @method cc.math.path.SegmentQuadratic#getParent
         * @returns {cc.math.path.Segment}
         */
        getParent() : ContainerSegment {
            return this._parent;
        }

        /**
         * Set the Segment's parent Segment.
         * @method cc.math.path.SegmentQuadratic#setParent
         * @param s {cc.math.path.Segment}
         */
        setParent( s : ContainerSegment ) : void {
            this._parent= s;
        }

        /**
         * Get the Segment length.
         * @override
         * @method cc.math.path.SegmentQuadratic#getLength
         * @returns {number}
         */
        getLength() : number {
            if ( this._dirty ) {
                this.__update();
            }
            return this._length;
        }

        /**
         * Sample some points on the segment. It will return either the sampled contour, or the flattened version of it.
         * It returns the points that conform the Segment contour, if they are changed, the contour will be changed as well.
         * @method cc.math.path.SegmentQuadratic#trace
         * @param numPoints {number=} number of points traced on the segment.
         * @param dstArray {Array<cc.math.Vector>=} array where to add the traced points.
         * @returns {Array<Vector>} returns the supplied array of points, or a new array of points if not set.
         */
        trace( numPoints? : number, dstArray? : Array<Vector> ) : Vector[] {

            if ( this._dirty ) {
                this.__update( numPoints );
            }

            dstArray= dstArray || [];

            // copy flattened polyline to dst array.
            if ( this._cachedContourPoints!==dstArray ) {
                for (var i = 0; i < this._cachedContourPoints.length; i++) {
                    dstArray.push(this._cachedContourPoints[i]);
                }
            }

            return dstArray;
        }

        /**
         * Get a point on the Segment at the given proportional position.
         * + If the segment is flattened, the value will be calculated from the internally cached curve contour.
         * + If not, if will be calculated by solving the curve.
         * The first is faster, but could be inaccurate for curves with a los number of flattened cached points.
         * @param normalizedPos {number} value in the range 0..1
         * @param out {cc.math.Vector=} optional out point. if not set, an internal spare point will be used.
         * @returns {cc.math.Vector} a point on the segment at the given position. This point should be copied,
         * successive calls to getValue will return the same point instance.
         */
        getValueAt( normalizedPos : number, out? : Vector ) : Vector {

            // if dirty, update curve info
            if ( this._dirty ) {
                this.__update();
            }

            // no out point, use a spare internal one. WARNING, will be continuously reused.
            out = out || __v0;

            // fix normalization values, just in case.
            if ( normalizedPos>1 || normalizedPos<-1 ) {
                normalizedPos %= 1;
            }
            if ( normalizedPos<0 ) {
                normalizedPos+=1;
            }

            if ( this._flattened ) {

                var fp = this._cachedContourPoints;
                var segment = ( normalizedPos * fp.length - 1 );
                normalizedPos = (segment - (segment | 0)) / (1 / (fp.length - 1));
                segment |= 0;

                out.x = fp[segment].x + (fp[segment + 1].x - fp[segment].x) * normalizedPos;
                out.y = fp[segment].y + (fp[segment + 1].y - fp[segment].y) * normalizedPos;

            } else {

                if ( normalizedPos===1 ) {
                    out.set( this._p1.x, this._p1.y );
                } else if ( normalizedPos===0 ) {
                    out.set( this._p0.x, this._p0.y );
                } else {

                    var cl0 = this._p0;
                    var cl1 = this._cp0;
                    var cl2 = this._p1;
                    var t1 = 1 - normalizedPos;
                    var t = normalizedPos;

                    // solve cubic bezier for nomalized time.
                    out.x = SegmentQuadratic.solve( this._p0.x, this._cp0.x, this._p1.x, t, t1 );
                    out.y = SegmentQuadratic.solve( this._p0.y, this._cp0.y, this._p1.y, t, t1 );
                }
            }

            return out;
        }

        static solve( v0:number,cv0:number,v1:number,t:number,t1:number) :number {
            return t1 * t1 * v0 + 2 * t1 * t * cv0 + t * t * v1;
        }

        /**
         * Get the Segment's starting point.
         * It returns the original starting Point reference, not a copy of it.
         * @returns {cc.math.Vector}
         */
        getStartingPoint() : Vector {
            return this._p0;
        }

        /**
         * Get the Segment's ending point.
         * It returns the original starting Point reference, not a copy of it.
         * @returns {cc.math.Vector}
         */
        getEndingPoint() : Vector {
            return this._p1;
        }

        /**
         * Make a clone of the segment.
         * @method cc.math.path.SegmentQuadratic#clone
         * @returns {cc.math.path.Segment}
         */
        clone() : SegmentQuadratic {

            var segment = new SegmentQuadratic({
                p0: {
                    x: this._p0.x,
                    y: this._p0.y
                },
                p1: {
                    x: this._cp0.x,
                    y: this._cp0.y
                },
                p2: {
                    x: this._p1.x,
                    y: this._p1.y
                }
            });

            if (this._flattened) {
                segment.flatten(this._cachedContourPoints.length);
            }

            segment._length= this._length;

            return segment;
        }

        /**
         * Add this Segment control points to the array.
         * If the array is not set, a new one will be created.
         * The actual Segment points are added, so modifying them means modifying the path.
         * @method cc.math.path.SegmentQuadratic#getControlPoints
         * @param arr {Array<cc.math.Vector>}
         * @returns {Array<cc.math.Vector>}
         */
        getControlPoints( arr? : Array<Point> ) : Array<Point> {
            arr= arr || [];

            arr.push( this._p0 );
            arr.push( this._cp0 );
            arr.push( this._p1 );

            return arr;
        }


        /**
         * Mark the quadratic as dirty. Mark internal polilyne info as invalid.
         * @methodcc.math.path.SegmentBezier#setDirty
         */

        /**
         * Mark the Segment dirty.
         * No action for Arcs.
         * @method cc.math.path.ContainerSegment#setDirty
         */
        setDirty() {
            this._dirty= true;
            var p : ContainerSegment= this._parent;
            while(p) {
                p.setDirty();
                p=p._parent;
            }
        }

        paint( ctx:cc.render.RenderingContext ) {

        }

    }
}