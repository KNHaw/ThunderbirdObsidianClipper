# bottles.py - Print out text to the song "100 bottles of beer." Useful for generating text text.

import argparse
parser = argparse.ArgumentParser(description='Print out text to the song "100 bottles of beer." Useful for generating text text.')
parser.add_argument('-b', '--bottles', dest='numBottles', type=int, required=False, default=99, help='Number of bottles to count')
args = parser.parse_args()

for i in range(args.numBottles, 1, -1):
    print("%d bottles of beer on the wall." % i)
    print("  %d bottles of beer." % i)
    print("  Take one down!")
    print("  Pass it around!")
    print("  %d bottles of beer on the wall!\n" % (i -1) )