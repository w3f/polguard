#!/bin/bash

source /scripts/common.sh
source /scripts/bootstrap-helm.sh


run_tests() {
    echo Running tests...

    wait_pod_ready redis-master
    wait_pod_ready watcher
    wait_pod_ready matrix
    wait_pod_ready telemetry
}

main(){

    /scripts/build-helmfile.sh

    run_tests
}

main
